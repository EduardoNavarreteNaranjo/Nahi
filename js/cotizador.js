document.addEventListener("DOMContentLoaded", () => {
  // Cachear elementos DOM
  const form = document.getElementById("cotizador-form");
  const resultado = document.getElementById("resultado");
  const btnPDF = document.getElementById("btnPDF");
  const clienteInput = document.getElementById("cliente");
  const consumoInput = document.getElementById("consumo");
  const tipoRedSelect = document.getElementById("tipoRed");
  const bateriaSelect = document.getElementById("bateria");
  const panelSelect = document.getElementById("panel");
  const labelBateria = document.getElementById("labelBateria");
  const roiSection = document.getElementById("roiSection");
  const porcentajeInput = document.getElementById("porcentaje-cubrir");
  
  setTimeout(() => {
    configurarPorcentajeCubrir();
  }, 100);

  // Constantes globales
  const DOLAR = 18.0;
  const PRECIO_BATERIA = 1000 * DOLAR * 1.345;
  const DESCUENTOS = {
    "nahi15": 0.85,
    "nahi10": 0.90,
    "nahi7": 0.93,
    "nahi5": 0.95,
    "nahi3": 0.97,
    "nahi2": 0.98,
    "nahi112": 1.12,
    "nahi111": 1.11,
    "nahi110": 1.10,
    "nahi109": 1.09,
    "nahi105": 1.05,
    "nahi103": 1.03
  };
  
  // Variables de estado
  let descuentoActual = 0;
  let datosCotizacion = {};
  let inversoresSeleccionados = [];
  let subtotalOriginal = 0;
  let panelesNecesarios = 0;
  let textoGarantia = "";
  let engancheInicial = 0;
  let porcentajeCubrir = 100; // Valor por defecto
  const MODELO_REGEX = /-x\d+$/i;
  const limpiarModelo = modelo => modelo.replace(MODELO_REGEX, '');

  // ========== FUNCIÓN APLICAR DESCUENTO ==========
  function aplicarDescuento(clave) {
    const factor = DESCUENTOS[clave];
    if (factor !== undefined) {
      descuentoActual = factor;
      actualizarTotales();
      
      // Mostrar mensaje de descuento aplicado
      const inputClave = document.getElementById("claveDescuento");
      if (inputClave) {
        if (factor < 1) {
          inputClave.placeholder = `Descuento ${((1 - factor) * 100).toFixed(0)}% aplicado`;
          inputClave.style.backgroundColor = "#e8f5e8";
        } else if (factor > 1) {
          inputClave.placeholder = `Recargo ${((factor - 1) * 100).toFixed(0)}% aplicado`;
          inputClave.style.backgroundColor = "#ffebee";
        }
      }
    } else if (clave === "") {
      // Si el input está vacío, quitar el descuento
      descuentoActual = 0;
      actualizarTotales();
      
      const inputClave = document.getElementById("claveDescuento");
      if (inputClave) {
        inputClave.placeholder = "";
        inputClave.style.backgroundColor = "";
      }
    } else {
      // Clave no válida - Asegurar que se restablezca a 0
      descuentoActual = 0;
      actualizarTotales();
      
      const inputClave = document.getElementById("claveDescuento");
      if (inputClave) {
        inputClave.placeholder = "Clave no válida";
        inputClave.style.backgroundColor = "#ffebee";
      }
    }
  }

  // NUEVAS CONSTANTES PARA MÉTRICAS ADICIONALES
  const TARIFA_CFE_PROMEDIO = 2.5; // pesos por kWh
  const INFLACION_ENERGETICA = 0.04; // 4% anual
  const VIDA_UTIL_SISTEMA = 25; // años
  const MANTENIMIENTO_ANUAL_POR_PANEL = 250; // pesos por panel por año

  // ========== FUNCIONES PARA CAMPOS EXTRA ==========
  
function agregarCampoExtra() {
  const tbody = document.getElementById('tbodyInversoresTabla');
  
  // Crear nueva fila
  const nuevaFila = document.createElement('tr');
  nuevaFila.className = 'fila-extra';
  nuevaFila.innerHTML = `
    <td>
      <input type="number" class="cantidad-extra" value="1" min="1" 
            style="width: 40px; padding: 6px 8px; font-size: 1rem; border: none; border-radius: 4px; text-align: center;" />
    </td>
    <td>
      <div style="display: flex; align-items: center; gap: 4px;">
        <button type="button" class="btn-eliminar-extra" 
                style="background: none; color: #dc3545; border: none; padding: 2px; cursor: pointer; font-size: 14px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ✕
        </button>
        <input type="text" class="descripcion-extra" placeholder="Descripción del concepto extra" 
              style="width: 50%; padding: 6px 8px 6px 20px; font-size: 1rem; border: none; border-radius: 4px; text-align: center;" />
      </div>
    </td>
    <td>
      <div style="position: relative;">
        <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #666; font-weight: bold; z-index: 1;">$</span>
        <input type="number" class="precio-unitario-extra" value="0" min="0" step="0.01" 
              style="width: 50%; padding: 6px 8px 6px 20px; font-size: 1rem; border: none; border-radius: 4px; text-align: center;" />
      </div>
    </td>
    <td class="subtotal-extra">$0</td>
  `;

  tbody.appendChild(nuevaFila);
  
  // Agregar event listeners a los nuevos campos
  const cantidadInput = nuevaFila.querySelector('.cantidad-extra');
  const precioInput = nuevaFila.querySelector('.precio-unitario-extra');
  const btnEliminar = nuevaFila.querySelector('.btn-eliminar-extra');
  
  cantidadInput.addEventListener('input', actualizarTotales);
  precioInput.addEventListener('input', actualizarTotales);
  btnEliminar.addEventListener('click', function() {
    nuevaFila.remove();
    actualizarTotales();
  });
  
  // Actualizar los totales para incluir el nuevo campo
  actualizarTotales();
}

// Función para calcular el total de todos los campos extra (retorna suma base sin IVA)
// Recibe factorIVA para mostrar los subtotales de cada fila correctamente
function calcularTotalExtra(factorIVA) {
  let totalBaseExtra = 0;
  document.querySelectorAll('.fila-extra').forEach(fila => {
    const cantidad = parseFloat(fila.querySelector('.cantidad-extra').value) || 0;
    const precioUnitario = parseFloat(fila.querySelector('.precio-unitario-extra').value) || 0;
    const subtotalBase = cantidad * precioUnitario;
    totalBaseExtra += subtotalBase;

    // Mostrar el subtotal de la fila con o sin IVA según el factor recibido
    const subtotalConIVA = subtotalBase * factorIVA;
    fila.querySelector('.subtotal-extra').textContent = formatearMoneda(subtotalConIVA);
  });
  return totalBaseExtra;
}

  // ========== FIN FUNCIONES CAMPOS EXTRA ==========

  // NUEVO: Event listener para el porcentaje de cubrir
  if (porcentajeInput) {
    porcentajeInput.addEventListener("input", function() {
      porcentajeCubrir = parseInt(this.value) || 100;
      if (porcentajeCubrir < 0) porcentajeCubrir = 0;
      if (porcentajeCubrir > 100) porcentajeCubrir = 100;
      
      // Si ya hay una cotización calculada, actualizar con el nuevo porcentaje
      if (datosCotizacion.consumoOriginal) {
        recalcularConPorcentaje();
      }
    });
  }

  // NUEVA FUNCIÓN: Recalcular todo cuando cambia el porcentaje
  function recalcularConPorcentaje() {
    if (!datosCotizacion.consumoOriginal) return;
    
    const consumoOriginal = datosCotizacion.consumoOriginal;
    const consumoAjustado = consumoOriginal * (porcentajeCubrir / 100);
    
    // Actualizar el consumo en el input
    consumoInput.value = Math.round(consumoAjustado);
    
    // Recalcular la cotización
    limpiarResultados();
    form.dispatchEvent(new Event('submit'));
  }

  // Función para actualizar todo con el porcentaje
  function actualizarTodoConPorcentaje() {
      if (!datosCotizacion.consumoOriginal) return;
      
      const consumoOriginal = datosCotizacion.consumoOriginal;
      const consumoAjustado = consumoOriginal * (porcentajeCubrir / 100);
      
      consumoInput.value = Math.round(consumoAjustado);
      
      limpiarResultados();
      form.dispatchEvent(new Event('submit'));
  }

  function calcularTiempoInstalacion(panelesNecesarios) {
    if (panelesNecesarios <= 8) {
      return 2;
    } else if (panelesNecesarios <= 12) {
      return 3;
    } else if (panelesNecesarios <= 20) {
      return 4;
    } else {
      const panelesAdicionales = panelesNecesarios - 20;
      const diasAdicionales = Math.ceil(panelesAdicionales / 5);
      return 3 + diasAdicionales;
    }
  }

  function obtenerTextoInstalacion(panelesNecesarios) {
    const dias = calcularTiempoInstalacion(panelesNecesarios);
    return `${dias} día${dias !== 1 ? 's' : ''}`;
  }

  // Agregar esta función que maneja todo automáticamente
  function configurarPorcentajeCubrir() {
    const porcentajeInput = document.getElementById("porcentaje-cubrir");
    const porcentajeValue = document.getElementById("porcentaje-value");
    
    if (!porcentajeInput) return;
    
    porcentajeInput.addEventListener("input", function() {
      porcentajeCubrir = parseInt(this.value) || 100;
      
      // Actualizar display
      if (porcentajeValue) {
        porcentajeValue.textContent = porcentajeCubrir + "%";
      }
      
      // Solo recalcular si ya tenemos una cotización base
      if (datosCotizacion.consumoOriginal) {
        setTimeout(() => {
          actualizarTodoConPorcentaje();
        }, 300);
      }
    });
  }

  // Llamar esta función al cargar la página
  configurarPorcentajeCubrir();

  // NUEVA FUNCIÓN: Calcular porcentaje de ahorro
  function calcularPorcentajeAhorro(consumoActual, energiaGenerada) {
    const porcentaje = (energiaGenerada / consumoActual) * 100;
    return Math.min(100, Math.round(porcentaje * 10) / 10); // Máximo 100%, un decimal
  }

  // NUEVA FUNCIÓN: Calcular ahorro económico anual
  function calcularAhorroAnual(energiaGenerada, tarifaKwh = TARIFA_CFE_PROMEDIO) {
    const energiaAnual = energiaGenerada * 6; // 6 bimestres al año
    return energiaAnual * tarifaKwh;
  }

  // NUEVA FUNCIÓN: Calcular ahorro mensual
  function calcularAhorroMensual(energiaGenerada, tarifaKwh = TARIFA_CFE_PROMEDIO) {
    const ahorroAnual = calcularAhorroAnual(energiaGenerada, tarifaKwh);
    return ahorroAnual / 12;
  }

  // NUEVA FUNCIÓN: Calcular pago estimado a CFE por porcentaje no cubierto
  function calcularPagoCFEResidual(consumoOriginal, energiaGenerada, tarifaKwh = TARIFA_CFE_PROMEDIO) {
    const energiaNoCubierta = Math.max(0, consumoOriginal - energiaGenerada);
    const pagoBimestral = energiaNoCubierta * tarifaKwh;
    const pagoMensual = pagoBimestral / 2;
    return {
      bimestral: pagoBimestral,
      mensual: pagoMensual,
      anual: pagoBimestral * 6
    };
  }

  // NUEVA FUNCIÓN: Calcular payback period
  function calcularPaybackPeriod(costoTotal, ahorroAnual, inflacion = INFLACION_ENERGETICA) {
    let ahorroAcumulado = 0;
    let años = 0;
    let ahorroAnualActual = ahorroAnual;
    
    while (ahorroAcumulado < costoTotal && años < VIDA_UTIL_SISTEMA) {
      años++;
      ahorroAcumulado += ahorroAnualActual;
      ahorroAnualActual *= (1 + inflacion);
    }
    
    if (ahorroAcumulado >= costoTotal) {
      const meses = Math.round((costoTotal - (ahorroAcumulado - ahorroAnualActual)) / (ahorroAnualActual / 12));
      return { años, meses, recuperado: true };
    } else {
      return { años: VIDA_UTIL_SISTEMA, meses: 0, recuperado: false };
    }
  }

  // NUEVA FUNCIÓN: Calcular ROI total en vida del sistema
  function calcularROITotal(costoTotal, ahorroAnual, inflacion = INFLACION_ENERGETICA) {
    let ahorroTotal = 0;
    let ahorroAnualActual = ahorroAnual;
    
    for (let año = 1; año <= VIDA_UTIL_SISTEMA; año++) {
      ahorroTotal += ahorroAnualActual;
      ahorroAnualActual *= (1 + inflacion);
    }
    
    const roiTotal = ahorroTotal - costoTotal;
    const roiPorcentaje = ((roiTotal / costoTotal) * 100).toFixed(0);
    
    return {
      ahorroTotal,
      roiTotal,
      roiPorcentaje,
      rentabilidad: roiTotal > 0 ? 'POSITIVA' : 'NEGATIVA'
    };
  }

  // NUEVA FUNCIÓN: Calcular impacto ambiental
  function calcularImpactoAmbiental(energiaGenerada) {
    const CO2_EVITADO_KWH = 0.5;
    const ARBOLES_EQUIVALENTES = 0.02;
    
    const energiaAnual = energiaGenerada * 6;
    const co2Evitado = (energiaAnual * CO2_EVITADO_KWH).toFixed(0);
    const arbolesEquivalentes = (energiaAnual * ARBOLES_EQUIVALENTES).toFixed(0);
    
    return {
      co2Evitado: `${co2Evitado} kg de CO2 anuales`,
      arbolesEquivalentes: `${arbolesEquivalentes} árboles equivalentes`,
      equivalencia: `Equivale a plantar ${arbolesEquivalentes} árboles al año`
    };
  }

  // Variables para cache de últimos valores
  let ultimoSubtotal = 0;
  let ultimoIVA = 0;
  let ultimoTotal = 0;
  let isCalculating = false;

  // Función para limpiar resultados
  function limpiarResultados() {
    resultado.style.display = "none";
    resultado.innerHTML = "";
    
    if (roiSection) roiSection.style.display = "none";
    
    const roiResultado = document.getElementById("roiResultado");
    if (roiResultado) roiResultado.innerHTML = "";
    
    descuentoActual = 0;
    datosCotizacion = {};
    inversoresSeleccionados = [];
    
    const inputClave = document.getElementById("claveDescuento");
    if (inputClave) inputClave.value = "";
  }

  // Función para actualizar cotización
  function actualizarCotizacion() {
    const consumo = parseFloat(consumoInput.value) || 0;
    const incluyeBateria = bateriaSelect.value === "si";
    const tipoRed = tipoRedSelect.value;
    let costoBateria = 0;

    if (incluyeBateria && tipoRed === "hibrido") {
      costoBateria = PRECIO_BATERIA;
    }

    resultado.textContent = `Total estimado: $${(consumo * 10 + costoBateria).toLocaleString("es-MX")}`;
  }

  // Función para mostrar/ocultar opciones de batería
  function mostrarOpcionesBateria() {
    const tipoRed = tipoRedSelect.value;
    const esHibrido = tipoRed === "hibrido";
    
    bateriaSelect.style.display = esHibrido ? "block" : "none";
    labelBateria.style.display = esHibrido ? "block" : "none";
    bateriaSelect.value = "no";
    
    actualizarCotizacion();
  }

  // ========== FUNCIÓN ACTUALIZAR UI TOTALES ==========
  function actualizarUITotales(subtotal, iva, total) {
    const pSubtotal = resultado.querySelector("#subtotal-text");
    const spanSubtotal = resultado.querySelector("#subtotal-amount");
    const spanIVA = resultado.querySelector("#iva-amount");
    const spanTotal = resultado.querySelector("#total-amount");
    const spanTotal2 = resultado.querySelector("#total-amount2");
    const spanPanelPromedio = resultado.querySelector("#panelPromedio");

    const checkboxDesglose = document.getElementById('mostrarDesglose');
    const mostrarDesglose = checkboxDesglose ? checkboxDesglose.checked : false;

    if (pSubtotal && spanSubtotal && spanIVA && spanTotal && spanPanelPromedio) {
      if (mostrarDesglose) {
        if (descuentoActual !== 0 && descuentoActual < 1) {
          pSubtotal.textContent = "Subtotal (con descuento):";
        } else if (descuentoActual > 1) {
          pSubtotal.textContent = "Subtotal:";
        } else {
          pSubtotal.textContent = "Subtotal:";
        }
      } else {
        pSubtotal.textContent = "Subtotal:";
      }
      
      spanSubtotal.textContent = formatearMoneda(subtotal);
      spanIVA.textContent = formatearMoneda(iva);
      spanTotal.textContent = formatearMoneda(total);
      spanTotal2.textContent = formatearMoneda(total);
      spanPanelPromedio.textContent = formatearMoneda(total / panelesNecesarios);
    }

    Object.assign(btnPDF.dataset, {
      subtotal: subtotal.toFixed(2),
      iva: iva.toFixed(2),
      total: total.toFixed(2)
    });
  }

  // Función de ayuda para formatear moneda
  function formatearMoneda(valor) {
    return `$${valor.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
  }

  function formatearPorcentaje(valor) {
    return `${valor.toFixed(1)}%`;
  }

  // Función para calcular ROI
  function calcularROI(costoTotal, energiaMensual, precioInicialKwh = 2.5, aumentoAnual = 0.04) {
    const tbody = document.querySelector("#roiTable tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    const porcentajeCubrir = datosCotizacion.porcentajeCubrir || 100;
    const consumoOriginal = datosCotizacion.consumoOriginal || parseFloat(consumoInput.value);
    
    let precioKwh = precioInicialKwh;
    let ahorroAcumulado = 0;
    let costoSinPaneles = 0;
    let anioROI = null;
    let mesROI = null;
    const tablaPDF = [];
    let encontrado = false;

    const energiaBimestral = energiaMensual * 2;
    const porcentajeAhorro = calcularPorcentajeAhorro(consumoOriginal, energiaBimestral);
    const ahorroAnual = calcularAhorroAnual(energiaBimestral, precioInicialKwh);
    const ahorroMensual = calcularAhorroMensual(energiaBimestral, precioInicialKwh);
    const payback = calcularPaybackPeriod(costoTotal, ahorroAnual, aumentoAnual);
    const roiTotal = calcularROITotal(costoTotal, ahorroAnual, aumentoAnual);
    const impactoAmbiental = calcularImpactoAmbiental(energiaBimestral);

    for (let anio = 1; anio <= 10; anio++) {
      let ahorroAnual = 0;

      for (let mes = 1; mes <= 12; mes++) {
        const ahorroMes = energiaMensual * precioKwh;
        const ahorroAnterior = ahorroAcumulado;
        ahorroAcumulado += ahorroMes;
        costoSinPaneles += ahorroMes;
        ahorroAnual += ahorroMes;

        if (!encontrado && ahorroAcumulado >= costoTotal) {
          encontrado = true;
          const fraccionMes = (costoTotal - ahorroAnterior) / ahorroMes;
          const mesesExactos = (anio - 1) * 12 + (mes - 1) + fraccionMes;
          
          anioROI = Math.floor(mesesExactos / 12);
          mesROI = Math.ceil(mesesExactos % 12);
          
          if (mesROI === 0) {
            mesROI = 12;
            anioROI -= 1;
          }
        }
      }

      const ahorroReal = ahorroAcumulado - costoTotal;
      const ahorroRealColor = ahorroReal >= 0 ? "green" : "red";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${anio}</td>
        <td>$${precioKwh.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
        <td>$${ahorroAnual.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
        
        <td style="color: ${ahorroRealColor}; font-weight: bold;">
          $${ahorroReal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
        </td>
      `;
      tbody.appendChild(row);

      tablaPDF.push([
        anio.toString(),
        `$${precioKwh.toFixed(2)}`,
        `$${ahorroAnual.toFixed(2)}`,
        `$${ahorroReal.toFixed(2)}`
      ]);

      precioKwh *= (1 + aumentoAnual);
    }

    const roiResultado = document.getElementById("roiResultado");
    if (roiResultado) {
      const mensajeROI = anioROI !== null
        ? `Recuperarás tu inversión en aproximadamente <strong>${anioROI} años y ${mesROI} meses si se paga de contado</strong>`
        : "No se recupera la inversión en 10 años.";

      roiResultado.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;">
          <div style="flex: 1; min-width: 300px; padding: 1rem; background: linear-gradient(135deg, #e3f2fd, #bbdefb); border-radius: 10px; border-left: 4px solid #1976d2;">
            <h4 style="margin: 0 0 0.5rem 0; color: #0d47a1;"> Ahorro Estimado</h4>
            <p style="margin: 0.25rem 0; font-size: 1.1rem;">
              <strong>${formatearPorcentaje(porcentajeAhorro)}</strong> de reducción en tu factura
            </p>
            <p style="margin: 0.25rem 0;">
              Ahorro mensual: <strong>${formatearMoneda(ahorroMensual)}</strong>
            </p>
            <p style="margin: 0.25rem 0;">
              Ahorro anual: <strong>${formatearMoneda(ahorroAnual)}</strong>
            </p>
          </div>

          <div style="flex: 1; min-width: 300px; padding: 1rem; background: linear-gradient(135deg, #e8f5e8, #c8e6c9); border-radius: 10px; border-left: 4px solid #388e3c;">
            <h4 style="margin: 0 0 0.5rem 0; color: #1b5e20;"> Retorno de Inversión</h4>
            <p style="margin: 0.25rem 0;">
Payback: <strong>${payback.recuperado ? `${anioROI} años ${mesROI} meses` : 'No recuperado'}</strong>
            <p style="margin: 0.25rem 0;">
              ROI 25 años: <strong>${formatearPorcentaje(parseFloat(roiTotal.roiPorcentaje))}</strong>
            </p>
          </div>

          <div style="flex: 1; min-width: 300px; padding: 1rem; background: linear-gradient(135deg, #f1f8e9, #dcedc8); border-radius: 10px; border-left: 4px solid #689f38;">
            <h4 style="margin: 0 0 0.5rem 0; color: #33691e;"> Impacto Ambiental</h4>
            <p style="margin: 0.25rem 0;">
              CO2 evitado: <strong>${impactoAmbiental.co2Evitado}</strong>
            </p>
            <p style="margin: 0.25rem 0;">
              ${impactoAmbiental.equivalencia}
            </p>
          </div>
        </div>

        <div style="margin-top: 1rem; padding: 1rem 1.5rem;min-width: 300px; padding: 1rem; background-color: #fff7e6; border-left: 4px solid #ffa500; border-radius: 8px; font-size: 0.9rem; line-height: 1.4;">
          ${mensajeROI}<br>
          <strong>Pago estimado a CFE sin paneles en 10 años:</strong> $${costoSinPaneles.toLocaleString("es-MX", { maximumFractionDigits: 0 })}<br>
          <strong>Rentabilidad total en 25 años:</strong> ${formatearMoneda(roiTotal.roiTotal)} (${roiTotal.rentabilidad})
        </div>
      `;
    }

    window.roiData = {
      tablaPDF,
      costoSinPaneles: costoSinPaneles.toFixed(2),
      anioROI,
      mesROI,
      metricasAdicionales: {
        porcentajeAhorro,
        ahorroAnual,
        ahorroMensual,
        payback,
        roiTotal,
        impactoAmbiental
      }
    };
  }

  // Función para generar PDF con ROI y Financiamiento
function generarPDF(nombreArchivo, incluirROI = false, incluirFinanciamiento = false) {
    const { jsPDF } = window.jspdf || window.jspdf.jsPDF;
    const doc = new jsPDF();

    if (incluirROI || incluirFinanciamiento) {
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    const clone = resultado.cloneNode(true);

    clone.querySelectorAll("select").forEach(select => {
        const selectId = select.id;
        const selectOriginal = document.getElementById(selectId);
        
        if (selectOriginal) {
            select.value = selectOriginal.value;
            
            const selectedText = select.options[select.selectedIndex]?.text || "";
            const span = document.createElement("span");
            span.textContent = limpiarModelo(selectedText);
            span.style.cssText = `
                display: inline-block;
                width: 100%;
                text-align: center;
                font-size: 14px;
                font-weight: 500;
            `;
            select.parentNode.replaceChild(span, select);
        }
    });

    clone.querySelectorAll("input[type=number]").forEach(input => {
        const inputId = input.id;
        const inputOriginal = document.getElementById(inputId);
        
        if (inputOriginal) {
            input.value = inputOriginal.value;
        }
        
        const span = document.createElement("span");
        
        if (input.classList.contains('precio-unitario-extra')) {
            const valorNumerico = parseFloat(input.value) || 0;
            span.textContent = formatearMoneda(valorNumerico);
        } else {
            span.textContent = input.value;
        }
        
        span.style.cssText = `
            display: inline-block;
            width: auto;
            min-width: 20px;
            padding: 0;
            margin: 0;
            border: none;
            background: transparent;
            font-size: 14px;
            font-weight: 500;
            text-align: center;
        `;
        input.parentNode.replaceChild(span, input);
    });

    clone.querySelectorAll("input.descripcion-extra").forEach(input => {
        const span = document.createElement("span");
        span.textContent = input.value || "Descripción del concepto extra";
        span.style.cssText = `
            display: inline-block;
            width: 100%;
            text-align: center;
            font-size: 14px;
            font-weight: 500;
        `;
        input.parentNode.replaceChild(span, input);
    });

    clone.querySelectorAll(".btn-eliminar-extra").forEach(btn => {
        btn.remove();
    });

    const combined = document.createElement("div");
    combined.className = "pdf-container";
    combined.style.cssText = `
        padding: 20px !important;
        margin: 0 auto !important;
        width: 100% !important;
        max-width: 800px !important;
        background: white;
        color: black;
        font-size: 14px;
        box-sizing: border-box;
    `;
    combined.innerHTML = clone.innerHTML;

    if ((incluirROI || incluirFinanciamiento) && roiSection) {
      const roiClone = roiSection.cloneNode(true);
      roiClone.querySelectorAll('.boton, button').forEach(b => b.remove());

      roiClone.querySelectorAll('div[style*="gradient"]').forEach(div => {
        const style = div.getAttribute('style');
        if (style.includes('linear-gradient')) {
          if (style.includes('#e3f2fd')) div.style.background = '#e3f2fd';
          else if (style.includes('#e8f5e8')) div.style.background = '#e8f5e8';
          else if (style.includes('#f1f8e9')) div.style.background = '#f1f8e9';
          div.style.color = '#000000';
          div.style.border = '1px solid #cccccc';
        }
      });

      roiClone.querySelectorAll('*').forEach(element => {
        const style = window.getComputedStyle(element);
        if (style.color === 'rgb(0, 0, 0)' || style.color === 'black') {
          element.style.color = '#000000';
          element.style.backgroundColor = 'transparent';
        }
      });

      const financiamientoEnROI = roiClone.querySelector('#financiamientoSection');
      if (financiamientoEnROI) financiamientoEnROI.remove();

      combined.appendChild(roiClone);

      const espacio = document.createElement('div');
      espacio.style.height = '10px';
      combined.appendChild(espacio);
    }
    
    if (incluirFinanciamiento) {
      const financiamientoSection = document.getElementById('financiamientoSection');
      if (financiamientoSection) {
        const cloneFinanciamiento = financiamientoSection.cloneNode(true);
        cloneFinanciamiento.querySelectorAll('.boton, button').forEach(b => b.remove());

        const labelsCheckboxes = cloneFinanciamiento.querySelectorAll('label');
        labelsCheckboxes.forEach(label => {
          if (label.innerHTML.includes('Excluir Mantenimiento') || 
              label.innerHTML.includes('Incluir Mantenimiento en Mensualidad')) {
            label.remove();
          }
        });

        const plazoMesesGroup = cloneFinanciamiento.querySelector('.input-group:has(#plazoMeses)');
        if (plazoMesesGroup) plazoMesesGroup.remove();
        
        const mensualidadGroup = cloneFinanciamiento.querySelector('.input-group:has(#mensualidadInput)');
        if (mensualidadGroup) mensualidadGroup.remove();
        
        const engancheInputGroup = cloneFinanciamiento.querySelector('.input-group:has(#engancheInput)');
        if (engancheInputGroup) engancheInputGroup.remove();
        
        const engancheMontoGroup = cloneFinanciamiento.querySelector('.input-group:has(#engancheMontoInput)');
        if (engancheMontoGroup) engancheMontoGroup.remove();

        const selectOriginal = financiamientoSection.querySelector('select');
        const selectClonado = cloneFinanciamiento.querySelector('select');
        if (selectOriginal && selectClonado) {
          selectClonado.value = selectOriginal.value;
        }

        const contenedor = cloneFinanciamiento.querySelector('.financiamiento-container');
        if (contenedor) {
          contenedor.style.transform = 'scale(1.14) translateX(-40px)';
          contenedor.style.transformOrigin = 'top left';
        }

        const pageBreakContainer = document.createElement("div");
        pageBreakContainer.style.cssText = `page-break-before: always; margin-top: 10px;`;
        pageBreakContainer.appendChild(cloneFinanciamiento);
        combined.appendChild(pageBreakContainer);
      }
    }

    combined.querySelectorAll('.boton, button').forEach(b => b.remove());

    const checkboxOriginal = document.getElementById('mostrarDesglose');
    const mostrarDesgloseEnPDF = checkboxOriginal ? checkboxOriginal.checked : false;

    const desglosePrecios = combined.querySelector('#desglose-precios');
    if (desglosePrecios) {
        if (mostrarDesgloseEnPDF) {
            desglosePrecios.style.display = 'block';
        } else {
            desglosePrecios.style.display = 'none';
            
            const subtotalText = desglosePrecios.querySelector('#subtotal-text');
            const subtotalAmount = desglosePrecios.querySelector('#subtotal-amount');
            const ivaAmount = desglosePrecios.querySelector('#iva-amount');
            
            if (subtotalText) subtotalText.remove();
            if (subtotalAmount) subtotalAmount.remove();
            if (ivaAmount) ivaAmount.remove();
        }
    }

    const checkboxDesglose = combined.querySelector('#mostrarDesglose');
    if (checkboxDesglose) {
        const label = checkboxDesglose.closest('label');
        if (label) {
            label.remove();
        } else {
            checkboxDesglose.remove();
        }
    }

    combined.querySelectorAll('*').forEach(element => {
        if (element.textContent.includes('Mostrar desglose') || 
            element.textContent.includes('mostrarDesglose')) {
            element.remove();
        }
    });

    const style = document.createElement('style');
    style.textContent = `
      @media print {
        .page-break { display: block; page-break-before: always; }
        * { background: white !important; color: black !important; border-color: #cccccc !important; }
        div[style*="gradient"] { background: #f8f9fa !important; border: 1px solid #dee2e6 !important; color: #212529 !important; }
        h4, p, strong, span { color: #000000 !important; background: transparent !important; }

        input, select {
          font-size: 14px !important;
          line-height: 1.2 !important;
          padding: 4px 8px !important;
          min-height: 32px !important;
          height: auto !important;
          width: 100% !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          text-align: right !important;
        }
        label {
          font-size: 13px !important;
          display: block !important;
          margin-bottom: 4px !important;
        }

        .fila-extra td:nth-child(2) {
          text-align: center !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        .descripcion-extra, span[style*="text-align: center"] {
          text-align: center !important;
          margin: 0 auto !important;
          display: block !important;
        }
        
        td[style*="text-align: center"] {
          text-align: center !important;
        }
        .fila-extra td {
          text-align: center !important;
          vertical-align: middle !important;
        }
      }

      .force-page-break { page-break-before: always !important; }
      .pdf-container table { margin-bottom: 15px !important; background: white !important; }
      .pdf-container > div:not(:first-child) { margin-top: 10px !important; }
      .metric-card { background: #f8f9fa !important; border: 1px solid #dee2e6 !important; border-radius: 10px; padding: 1rem; margin: 0.5rem 0; color: #212529 !important; }
      .metric-card h4 { color: #0d47a1 !important; margin: 0 0 0.5rem 0; }
      .metric-card p { color: #000000 !important; margin: 0.25rem 0; }

      .fila-extra td:nth-child(2) {
        text-align: center !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
      }
      .fila-extra .descripcion-extra {
        text-align: center !important;
        margin: 0 auto !important;
      }
      
      .descripcion-extra-pdf {
        text-align: center !important;
        display: block !important;
        width: 100% !important;
        margin: 0 auto !important;
      }
    `;
    combined.appendChild(style);

    combined.querySelectorAll('div').forEach(div => {
      const style = div.getAttribute('style');
      if (style && style.includes('linear-gradient')) {
        div.classList.add('metric-card');
        div.style.background = '#f8f9fa';
        div.style.border = '1px solid #dee2e6';
        div.style.color = '#000000';
      }
    });

    doc.html(combined, {
      callback: function (doc) {
        doc.save(nombreArchivo);
        if (combined.parentNode) combined.parentNode.removeChild(combined);
      },
      margin: [14, 20, 14, 20],
      autoPaging: 'text',
      html2canvas: {
        scale: 0.22,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        ignoreElements: (element) => false
      },
      width: 190,
      windowWidth: 800
    });
  }

  // Función para obtener costo CFE
  function obtenerCostoTotalCFE(consumo) {
    if (consumo <= 150) return consumo * 1.25;
    if (consumo <= 280) return (150 * 1.25) + ((consumo - 150) * 1.5);
    return (150 * 1.25) + (130 * 1.5) + ((consumo - 280) * 4.4);
  }

  // NUEVA FUNCIÓN: Mostrar resumen ejecutivo con métricas clave
  function crearResumenEjecutivo(cliente, consumo, energiaBimestral, capacidadRequeridaKWh, totalOriginal) {
    const porcentajeAhorro = calcularPorcentajeAhorro(consumo, energiaBimestral);
    const ahorroAnual = calcularAhorroAnual(energiaBimestral);
    const ahorroMensual = calcularAhorroMensual(energiaBimestral);
    const payback = calcularPaybackPeriod(totalOriginal, ahorroAnual);
    const impactoAmbiental = calcularImpactoAmbiental(energiaBimestral);
    const costoCFEActual = obtenerCostoTotalCFE(consumo);
  }

  // Event listeners
  clienteInput.addEventListener("input", limpiarResultados);
  consumoInput.addEventListener("input", function() {
    if (!datosCotizacion.consumoOriginal || porcentajeCubrir === 100) {
      datosCotizacion.consumoOriginal = parseFloat(this.value) || 0;
    }
    limpiarResultados();
    actualizarCotizacion();
  });
  
  tipoRedSelect.addEventListener("change", function() { 
    mostrarOpcionesBateria();
    limpiarResultados();
  });
  
  bateriaSelect.addEventListener("change", function() { 
    actualizarCotizacion();
    limpiarResultados();
  });
  
  panelSelect.addEventListener("change", function() { 
    actualizarCotizacion();
    limpiarResultados();
  });

  // Manejo del formulario
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    limpiarResultados(); 
    
    const cliente = clienteInput.value.trim();
    const consumo = parseFloat(consumoInput.value);
    const tipoRed = tipoRedSelect.value;

    if (!cliente || isNaN(consumo)) {
      alert("Por favor llena correctamente el nombre y consumo.");
      return;
    }

    // Obtener panel seleccionado
    const panel = panelSelect.value;
    let watts, precioPanelBase;

    if (panel === "615W-Bifacial") {
      watts = 0.615;
      precioPanelBase = 85;
    } else if (panel === "625W-Bifacial") {
      watts = 0.625;
      precioPanelBase = 97;
      } else if (panel === "710W-Bifacial") {
      watts = 0.710;
      precioPanelBase = 125;
    } else {
      watts = 0.510;
      precioPanelBase = 120;
    }

    // Cálculos optimizados
    const consumoDiario = consumo / 60;
    const energiaPanelDia = watts * 4.5 * .95;
    const porcentajeCubrir = parseFloat(document.getElementById("porcentaje-cubrir").value) || 100;
    const factor = porcentajeCubrir / 100;
    panelesNecesarios = Math.round((consumoDiario * factor) / energiaPanelDia);

    let energiaBimestral = Math.ceil((energiaPanelDia * panelesNecesarios) * 60);
    const capacidadRequeridaKWh = panelesNecesarios * watts;

    // Determinar archivo de inversores
    let archivoInversores;
    if (tipoRed === "trifasica") {
      archivoInversores = "data/inversores_trifasica.csv";
    } else if (tipoRed === "bifasica") {
      archivoInversores = "data/inversores.csv";
    } else if (tipoRed === "hibrido") {
      archivoInversores = "data/hibridos.csv";
    } else {
      archivoInversores = "data/microinversor.csv";
    }

    // Procesar archivo CSV
    Papa.parse(archivoInversores, {
      download: true,
      header: true,
      complete: function(results) {
        const inversores = results.data
          .map(i => ({
            modelo: i.modelo,
            capacidad: parseFloat(i.capacidad),
            limite_max: parseFloat(i.limite_max),
            precio: parseFloat(i.precio)
          }))
          .filter(i => !isNaN(i.capacidad) && !isNaN(i.limite_max) && !isNaN(i.precio));

        const inversoresOrdenados = inversores.sort((a, b) => a.limite_max - b.limite_max);
        let capacidadRestante = capacidadRequeridaKWh;
        inversoresSeleccionados = [];
        const inversorMaximo = inversoresOrdenados[inversoresOrdenados.length - 1];
        
        if (inversorMaximo) {
          const cantidadMaximos = Math.floor(capacidadRestante / inversorMaximo.limite_max);
          if (cantidadMaximos > 0) {
            inversoresSeleccionados.push({
              modelo: inversorMaximo.modelo,
              capacidad: inversorMaximo.limite_max,
              precio: inversorMaximo.precio,
              cantidad: cantidadMaximos
            });
            capacidadRestante -= cantidadMaximos * inversorMaximo.limite_max;
          }
        }

        if (capacidadRestante > 0 && inversoresOrdenados.length > 0) {
          const inversorParaResto = inversoresOrdenados.find(i => i.limite_max >= capacidadRestante) || inversoresOrdenados[0];
          const existente = inversoresSeleccionados.find(inv => inv.modelo === inversorParaResto.modelo);
          
          if (existente) {
            existente.cantidad += 1;
          } else {
            inversoresSeleccionados.push({
              modelo: inversorParaResto.modelo,
              capacidad: inversorParaResto.limite_max,
              precio: inversorParaResto.precio,
              cantidad: 1
            });
          }
        }

        if (inversoresSeleccionados.length === 0) {
          alert("No hay inversor compatible.");
          return;
        }

        // Cálculo de precios optimizado
        const precioPanel = precioPanelBase * 2.0 * DOLAR;
        let precioInversor = inversoresSeleccionados.reduce((total, inv) => {
          return total + inv.precio * inv.cantidad * DOLAR * 1.7;
        }, 0);

        let CFE;
        if (capacidadRequeridaKWh <= 10) {
          CFE = 3000;
        } else if (capacidadRequeridaKWh <= 15) {
          CFE = 16300;
        } else if (capacidadRequeridaKWh <= 50) {
          CFE = 20750;
        } else if (capacidadRequeridaKWh <= 75) {
          CFE = 25300;
        } else if (capacidadRequeridaKWh <= 150) {
          CFE = 35500;
        } else if (capacidadRequeridaKWh <= 300) {
          CFE = 51950;
        } else if (capacidadRequeridaKWh <= 500) {
          CFE = 64900;
        } else if (capacidadRequeridaKWh <= 750) {
          CFE = 89750;
        } else {
          CFE =105100; 
        }
        
        let BOS = 600;
        const Obra = 800;
        let Estructura = 950;
        let ObraElectrica = 500;

        let mejorModelo;
    
        if (tipoRed === "microinversor") {
          mejorModelo = inversores.reduce((mejor, actual) => {
            if (actual.limite_max >= capacidadRequeridaKWh) {
              if (!mejor || actual.limite_max < mejor.limite_max) {
                return actual;
              }
            }
            return mejor;
          }, null) || inversores[inversores.length - 1];
          
          mejorModelo = inversores[0];
          
          const unidades = Math.ceil(capacidadRequeridaKWh / mejorModelo.limite_max);
          const margen = 1.7;
          
          inversoresSeleccionados = [{
            modelo: mejorModelo.modelo,
            capacidad: mejorModelo.limite_max,
            precio: mejorModelo.precio,
            cantidad: unidades
          }];
          
          precioInversor = mejorModelo.precio * unidades * DOLAR * margen;
        }

        if (tipoRed === "hibrido") {
          precioInversor = inversoresSeleccionados.reduce((total, inv) => 
            total + (inv.precio + 20) * inv.cantidad * DOLAR * 1.65, 0);
        }

        if (panel === "510K-Flexible") {
          Estructura = 200;
        }

        // Costo de batería
        const costoBateria = bateriaSelect.value === "si" ? PRECIO_BATERIA : 0;

        // Cálculo de totales
        subtotalOriginal = (panelesNecesarios * precioPanel) + precioInversor + CFE +
          (panelesNecesarios * BOS) + (panelesNecesarios * Obra) +
          (panelesNecesarios * Estructura) + (panelesNecesarios * ObraElectrica) + costoBateria;
        
        const ivaOriginal = subtotalOriginal * 0.16;
        const totalOriginal = subtotalOriginal + ivaOriginal;
        const panelValue = limpiarModelo(panel);
        const PanelPromedioOriginal = totalOriginal / panelesNecesarios;
        
        // Guardar datos
        datosCotizacion = {
          subtotalOriginal,
          ivaOriginal,
          totalOriginal,
          panelesNecesarios,
          panelValue,
          precioPanel,
          BOS,
          Obra,
          Estructura,
          ObraElectrica,
          costoBateria,
          inversores,
          energiaBimestral,
          capacidadRequeridaKWh,
          CFE,
          tipoRed
        };

        // Mostrar resultados
        mostrarResultados(cliente, consumo, capacidadRequeridaKWh);
      },
      error: function(error) {
        console.error("Error procesando CSV:", error);
        alert("Ocurrió un error al cargar los datos de inversores");
      }
    });
  });

  // Función para mostrar resultados
  function mostrarResultados(cliente, consumo, capacidadRequeridaKWh) {
    if (roiSection) roiSection.style.display = "none";
    const inputClave = document.getElementById("claveDescuento");
    if (inputClave) inputClave.value = "";
    descuentoActual = 0;

    const { 
      subtotalOriginal, 
      ivaOriginal, 
      totalOriginal, 
      panelesNecesarios, 
      panelValue,
      precioPanel,
      CFE,
      BOS,
      Obra,
      Estructura,
      ObraElectrica,
      costoBateria,
      inversores,
      energiaBimestral,
      tipoRed 
    } = datosCotizacion;

    if (tipoRed === "microinversor") {
      textoGarantia = "12 años en paneles y 12 años en microinversor, 1 año instalación.";
    } else {
      textoGarantia = "12 años en paneles y 10 años en inversor, 1 año instalación.";
    }
    
    const PanelPromedioOriginal = totalOriginal / panelesNecesarios;

    // Generar HTML del resultado
    resultado.innerHTML = `
      <h2 style="text-align: center; font-size: 2.5rem; font-weight: bold; margin-bottom: .5rem;">Resumen de Cotización</h2>
      <div style="width: 100%; display: flex; justify-content: center;">
        <div id="logoBlockinicial" style="display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
          <img id="logoImg" src="img/logo-nahi.png" alt="Logo NAHI" style="height: 80px; object-fit: contain;">
          <p id="logoTexto" style="margin-top: 1rem; font-weight: bold; color: #007acc; font-size: 1.2rem;">
            ENERGÍA SOLAR RENOVABLE
          </p>
        </div>
      </div>

      <div class="contenedor-inicial" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; width: 100%; box-sizing: border-box; background-color: #f8f9fa; border-radius: 10px; padding: 1rem;">
        <div class="resumen-cotizacion" style="flex: 1 1 45%; padding: 1rem; background-color: #f8f9fa; border-radius: 10px; box-sizing: border-box;">
          <div style="margin-bottom: 0.2rem;">
            <input type="password" id="claveDescuento" placeholder="" style="width: 100px; padding: 0.25rem; font-size: 0.85rem; border: none; background-color: #f8f9fa; margin-bottom: 0.1rem;" />
          </div>
          <p style="margin: 0.25rem 0;"><strong>Ponte en contacto:</strong></p>
          <p style="margin: 0.25rem 0;"><strong>Email:</strong>adm@nahienergia.com</p>
          <p style="margin: 0.25rem 0;"><strong>Teléfono:</strong> 3311866965</p>
          <p style="margin: 1.5rem 0;"></p>
          <p style="margin: 0.25rem 0;"><strong>Costo promedio x panel:</strong><span id="panelPromedio">${formatearMoneda(PanelPromedioOriginal)}</span></p>
          <p style="margin: 0.25rem 0;"><strong>Costo Total:</strong><span id="total-amount">${formatearMoneda(totalOriginal)}</span></p>
        </div>

        <div class="resumen-datos" style="flex: 1 1 45%; padding: 1rem; background-color: #f8f9fa; border-radius: 10px; box-sizing: border-box;">
          <p style="margin: 0.25rem 0;"><strong>Nombre del Cliente:</strong> ${cliente}</p>
          <p style="margin: 0.25rem 0;"><strong>Paneles necesarios:</strong> ${panelesNecesarios.toLocaleString("es-MX")} de ${panelValue}</p>
          <p id="inversoresSugeridos" style="margin: 0.25rem 0;"><strong>Inversores sugeridos:</strong> ${inversoresSeleccionados.map(inv => `${inv.cantidad} x ${limpiarModelo(inv.modelo)}`).join(', ')}</p>
          <p style="margin: 0.25rem 0;"><strong>Consumo bimestral:</strong> ${consumo.toLocaleString("es-MX")} kWh</p>
          <p style="margin: 0.25rem 0;"><strong>Energía estimada generada:</strong> ${energiaBimestral.toLocaleString("es-MX")} kWh</p>
          <p style="margin: 0.25rem 0;"><strong>Sistema Capacidad:</strong> ${capacidadRequeridaKWh.toFixed(2)} kWh</p>
        </div> 
      </div>

      <button id="btnVerDetalles" class="boton">Ver detalles completos</button>

      <!-- Detalles ocultos por defecto -->
      <div id="detallesCotizacion" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
          <div id="logoBlock" style="display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
            <img id="logoImg" src="img/logo-nahi.png" alt="Logo NAHI" style="height: 80px; object-fit: contain;">
            <p id="logoTexto" style="margin-top: 1rem; font-weight: bold; color: #007acc; font-size: 1.2rem;">ENERGÍA SOLAR RENOVABLE</p>
            <div style="text-align: left;">
              <p style="margin: 0.25rem 0;"><strong>Ponte en contacto:</strong></p>
              <p style="margin: 0.25rem 0;"><strong>Email:</strong> adm@nahienergia.com</p>
              <p style="margin: 0.25rem 0;"><strong>Teléfono:</strong> 3311866965</p>
              <p style="margin: 0.25rem 0;"><strong>Costo promedio x panel:</strong><span id="panelPromedio">${formatearMoneda(PanelPromedioOriginal)}</span></p>
            </div>
          </div>

          <div class="totales-cotizacion">
            <p><strong>Nombre de Cliente:</strong> ${cliente}</p>
            <p><strong>Consumo bimestral:</strong> ${consumo.toLocaleString("es-MX")} kWh</p>
            <p><strong>Energía estimada generada:</strong> ${energiaBimestral.toLocaleString("es-MX")} kWh</p>
            <p><strong>Paneles necesarios:</strong> ${panelesNecesarios.toLocaleString("es-MX")} de ${panelValue}</p>
            <p><strong>Sistema Capacidad:</strong> ${capacidadRequeridaKWh.toFixed(2)} kWh</p>
          </div>
        </div>

        <div class="tabla-responsive">
          <table>
            <thead>
              <tr>
                <th>Cantidad</th>
                <th>Descripción</th>
                <th>Precio Unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody id="tbodyInversoresTabla">
              <tr>
                <td>${panelesNecesarios}</td>
                <td>Panel solar ${panelValue}</td>
                <td id="precio-unitario-panel">${formatearMoneda(precioPanel)}</td>
                <td id="subtotal-panel">${formatearMoneda(panelesNecesarios * precioPanel)}</td>
         
              </tr>
             ${inversoresSeleccionados.map((inv, index) => {
    const precioUnitario = inv.precio * DOLAR * 1.7;
    const subtotal = precioUnitario * inv.cantidad;
    return `
        <tr>
            <td style="text-align: center;">
                <input type="number" id="cantidad-inversor-${index}" value="${inv.cantidad}" min="1" 
                      style="width: 40px; padding: 6px 8px; font-size: 1rem; border: none; border-radius: 4px; text-align: center;" />
            </td>
            <td style="text-align: center;">
                <select id="modelo-inversor-${index}" 
                        style="width: 100%; max-width: 400px; padding: 6px 8px; border: none; 
                               font-size: 1rem; margin: 6px auto; background: transparent; 
                               color: black; appearance: none; -webkit-appearance: none; 
                               -moz-appearance: none; display: block; 
                               text-align-last: center;"
                        onchange="actualizarModeloInversor(${index}, this.value)">
                    ${datosCotizacion.inversores.map(i => `
                        <option value="${i.modelo}" ${i.modelo === inv.modelo ? 'selected' : ''} 
                                style="text-align: center;">
                            ${limpiarModelo(i.modelo)}
                        </option>`).join('')}
                </select>
            </td>
            <td id="precio-unitario-inversor-${index}" style="text-align: center;">${formatearMoneda(precioUnitario)}</td>
            <td id="subtotal-inversor-${index}" style="text-align: center;">${formatearMoneda(subtotal)}</td>
        </tr>
    `;
              }).join('')}
              <tr>
                <td>1</td>
                <td>Gestión CFE/UVIE</td>
                <td id="precio-unitario-cfe">${formatearMoneda(CFE)}</td>
                <td id="subtotal-cfe">${formatearMoneda(CFE)}</td>
               
              </tr>
              <tr>
                <td>${panelesNecesarios}</td>
                 <td>Componentes BOS: cables, conectores y protecciones.</td>
                <td id="precio-unitario-bos">${formatearMoneda(BOS)}</td>
                <td id="subtotal-bos">${formatearMoneda(panelesNecesarios * BOS)}</td>
               
              </tr>
              <tr>
                <td>${panelesNecesarios}</td>
                <td>Instalación Mano de Obra</td>
                <td id="precio-unitario-obra">${formatearMoneda(Obra)}</td>
                <td id="subtotal-obra">${formatearMoneda(panelesNecesarios * Obra)}</td>
              
              </tr>
              <tr>
                <td>${panelesNecesarios}</td>
                <td>Estructura de Aluminio para Paneles</td>
                <td id="precio-unitario-estructura">${formatearMoneda(Estructura)}</td>
                <td id="subtotal-estructura">${formatearMoneda(panelesNecesarios * Estructura)}</td>
               
              </tr>
              <tr>
                <td>${panelesNecesarios}</td>
                <td>Obra Eléctrica</td>
                <td id="precio-unitario-obra-electrica">${formatearMoneda(ObraElectrica)}</td>
                <td id="subtotal-obra-electrica">${formatearMoneda(panelesNecesarios * ObraElectrica)}</td>
         
              </tr>
              ${bateriaSelect.value === "si" ? `
              <tr>
                <td>
                  <input type="number" id="cantidad-bateria" value="1" min="1" style="width: 30px; padding: 6px 8px; font-size: 1rem; border: none; border-radius: 4px; text-align: center;" />
                </td>
                <td>Batería 5kW</td>
                <td id="precio-unitario-bateria">${formatearMoneda(PRECIO_BATERIA)}</td>
                <td id="subtotal-bateria">${formatearMoneda(PRECIO_BATERIA)}</td>
              
              </tr>` : ''}
              <!-- SE ELIMINÓ LA FILA EXTRA POR DEFECTO -->
            </tbody>
          </table>
        </div>

        <!-- Botón para agregar más campos extra -->
        <button id="btnAgregarExtra" class="boton" style="margin-top: 1rem;">+ Agregar Concepto Extra</button>

        <div class="contenedor-final">
          <div class="detalles-cotizacion">
            <p><strong>Forma de pago:</strong> 50% anticipo, 50% al terminar instalación(Sin plan a meses).</p>
            <p><strong>Vigencia:</strong> 10 días hábiles.</p>
            <p><strong>Tiempo estimado de instalación:</strong> ${obtenerTextoInstalacion(panelesNecesarios)}</p>
            <p><strong>Garantía:</strong> ${textoGarantia}</p>
          </div>

          <div class="totales-cotizacion">
            <!-- MODIFICACIÓN: Checkbox para mostrar desglose de precios -->
            <label style="display: block; margin-bottom: 1rem; cursor: pointer;">
              <input type="checkbox" id="mostrarDesglose" style="margin-right: 8px;">
              Mostrar desglose de precios
            </label>
            
            <!-- MODIFICACIÓN: Desglose oculto por defecto -->
            <div id="desglose-precios" style="display: none;">
              <p><strong id="subtotal-text">Subtotal:</strong> 
                <span id="subtotal-amount" style="float: right;">${formatearMoneda(subtotalOriginal)}</span>
              </p>
              <p><strong>IVA (16%):</strong> 
                <span id="iva-amount" style="float: right;">${formatearMoneda(ivaOriginal)}</span>
              </p>
            </div>
            
            <!-- MODIFICACIÓN: Total siempre visible -->
            <p><strong style="color: #007acc; font-size: 1.1rem;">Total:</strong> 
              <span id="total-amount2" style="float: right; font-weight: bold;">${formatearMoneda(totalOriginal)}</span>
            </p>
            <p><strong style="background-color: #fff7e6; border-radius: 8px;">La cotización no incluye obra civil, en caso de ser necesaria para la instalación</strong></p>
          </div>
       
          <div style="
            margin-top: 1rem; 
            padding: 1rem 1.5rem; 
            background-color: #fff7e6; 
            border-left: 4px solid #ffa500; 
            border-radius: 8px; 
            font-size: 0.9rem; 
            line-height: 1.4; 
            flex: 1 1 700px; 
            max-width: 950px;
          ">
            <p><strong> La duración de los trámites depende de la eficacia de la CFE y un historial libre de adeudos por parte del cliente.</p>
          </div>
          <button id="btnOcultarDetalles" class="boton">← Regresar al resumen</button>
        </div>
      </div>
    `;

    // Botones adicionales
    const btnCotizacionPDF = document.createElement("button");
    btnCotizacionPDF.id = "btnCotizacionPDF";
    btnCotizacionPDF.textContent = "Generar PDF Cotización";
    btnCotizacionPDF.style.marginTop = "1rem";
    resultado.appendChild(btnCotizacionPDF);

    const btnROI = document.createElement("button");
    btnROI.id = "btnROI";
    btnROI.className = "btn btn-success mt-3 ml-2";
    btnROI.textContent = "Retorno de Inversión";
    resultado.appendChild(btnROI);

    // Inicializar eventos
    initEventosDinamicos();
    
    // Mostrar resultados
    resultado.style.display = "block";
    btnPDF.style.display = "inline-block";
  }

  // Función para actualizar modelo de inversor
function actualizarModeloInversor(index, nuevoModelo) {
    const nuevoInv = datosCotizacion.inversores.find(i => i.modelo === nuevoModelo);
    if (nuevoInv) {
        inversoresSeleccionados[index] = {...nuevoInv, cantidad: inversoresSeleccionados[index].cantidad};
        actualizarTotales();
        
        // Actualizar también el texto en el resumen
        const textoInversores = inversoresSeleccionados
            .map(inv => `${inv.cantidad} x ${limpiarModelo(inv.modelo)}`)
            .join(", ");
        
        const sugeridos = document.getElementById("inversoresSugeridos");
        if (sugeridos) {
            sugeridos.innerHTML = `<strong>Inversores sugeridos:</strong> ${textoInversores}`;
        }
    }
}

  // Función para inicializar eventos dinámicos
  function initEventosDinamicos() {
    const inputClave = document.getElementById("claveDescuento");
    if (inputClave) {
      let timeoutDescuento;
      inputClave.addEventListener("input", (e) => {
        clearTimeout(timeoutDescuento);
        timeoutDescuento = setTimeout(() => {
          aplicarDescuento(e.target.value.trim());
          if (roiSection) roiSection.style.display = "none";
        }, 300);
      });
    }

    // Botón ver detalles
    const btnVerDetalles = document.getElementById("btnVerDetalles");
    if (btnVerDetalles) {
      btnVerDetalles.addEventListener("click", mostrarDetalles);
    }

    // Botón ocultar detalles
    const btnOcultarDetalles = document.getElementById("btnOcultarDetalles");
    if (btnOcultarDetalles) {
      btnOcultarDetalles.addEventListener("click", ocultarDetalles);
    }

    // Botón Cotización PDF
    const btnCotizacionPDF = document.getElementById("btnCotizacionPDF");
    if (btnCotizacionPDF) {
      btnCotizacionPDF.addEventListener("click", () => {
        generarPDF("cotizacion_solar_NAHI.pdf");
      });
    }

    // Botón ROI
    const btnROI = document.getElementById("btnROI");
    if (btnROI) {
      btnROI.addEventListener("click", mostrarROI);
    }

    // Evento para PDF con ROI
    btnPDF.addEventListener("click", () => {
      generarPDF("cotizacion_con_ROI_NAHI.pdf", true);
    });
  }

  // Función para mostrar detalles
  function mostrarDetalles() {
    document.querySelectorAll(".contenedor-inicial").forEach(el => el.style.display = "none");
    const logoInicial = document.getElementById("logoBlockinicial");
    if (logoInicial) logoInicial.style.display = "none";
    document.getElementById("detallesCotizacion").style.display = "block";
    document.getElementById("btnVerDetalles").style.display = "none";

    // Listeners para inversores
    document.querySelectorAll("input[id^='cantidad-inversor']").forEach(input => {
      input.addEventListener("input", (e) => {
        const index = parseInt(e.target.id.replace("cantidad-inversor-", ""), 10);
        const nuevaCantidad = parseInt(e.target.value, 10) || 1;
        inversoresSeleccionados[index].cantidad = nuevaCantidad;
        actualizarTotales();
      });
    });

    document.querySelectorAll("select[id^='modelo-inversor']").forEach(select => {
      select.addEventListener("change", (e) => {
        const index = parseInt(e.target.id.replace("modelo-inversor-", ""), 10);
        const nuevoModelo = e.target.value;
        const nuevoInv = datosCotizacion.inversores.find(i => i.modelo === nuevoModelo);
        if (nuevoInv) {
          inversoresSeleccionados[index] = {...nuevoInv, cantidad: inversoresSeleccionados[index].cantidad};
          actualizarTotales();
        }
      });
    });

    // Listener para batería
    const cantidadBateriaInput = document.getElementById("cantidad-bateria");
    if (cantidadBateriaInput) {
      cantidadBateriaInput.addEventListener("input", function(e) {
        actualizarTotales();
      });
    }

    // AGREGAR BOTÓN PARA CAMPO EXTRA
    const btnAgregarExtra = document.getElementById('btnAgregarExtra');
    if (btnAgregarExtra) {
      btnAgregarExtra.addEventListener('click', agregarCampoExtra);
    }

    // MODIFICACIÓN: Agregar event listener para el checkbox de desglose
    const checkboxDesglose = document.getElementById('mostrarDesglose');
    const desglosePrecios = document.getElementById('desglose-precios');
    
    if (checkboxDesglose && desglosePrecios) {
      checkboxDesglose.addEventListener('change', function() {
        if (this.checked) {
          desglosePrecios.style.display = 'block';
        } else {
          desglosePrecios.style.display = 'none';
        }
        actualizarTotales();
      });
    }

    actualizarTotales();
  }

  // Función para ocultar detalles
  function ocultarDetalles() {
    document.getElementById("detallesCotizacion").style.display = "none";
    document.querySelectorAll(".contenedor-inicial").forEach(el => el.style.display = "flex");
    const logoInicial = document.getElementById("logoBlockinicial");
    if (logoInicial) logoInicial.style.display = "flex";
    document.getElementById("btnVerDetalles").style.display = "inline-block";
  }

  // ========== FUNCIÓN ACTUALIZAR TOTALES CORREGIDA ==========
  function actualizarTotales() {
    if (isCalculating) return;
    isCalculating = true;

    // Obtener el estado del checkbox de desglose
    const checkboxDesglose = document.getElementById('mostrarDesglose');
    const incluirIVA = checkboxDesglose ? !checkboxDesglose.checked : false;
    const factorIVA = incluirIVA ? 1.16 : 1;

    const factor = descuentoActual === 0 ? 1 : descuentoActual;

    let subtotalBase = 0; // Acumulador base (sin IVA)

    // ---------- Paneles ----------
    const precioPanelBase = datosCotizacion.precioPanel * factor;
    subtotalBase += panelesNecesarios * precioPanelBase;
    const precioPanelConIVA = precioPanelBase * factorIVA;
    document.getElementById("precio-unitario-panel").textContent = formatearMoneda(precioPanelConIVA);
    document.getElementById("subtotal-panel").textContent = formatearMoneda(panelesNecesarios * precioPanelConIVA);

    // ---------- Inversores ----------
    inversoresSeleccionados.forEach((inv, index) => {
      const precioUnitarioBase = inv.precio * DOLAR * 1.7 * factor;
      subtotalBase += precioUnitarioBase * inv.cantidad;
      const precioUnitarioConIVA = precioUnitarioBase * factorIVA;
      const tdPrecio = document.getElementById(`precio-unitario-inversor-${index}`);
      const tdSubtotal = document.getElementById(`subtotal-inversor-${index}`);
      if (tdPrecio) tdPrecio.textContent = formatearMoneda(precioUnitarioConIVA);
      if (tdSubtotal) tdSubtotal.textContent = formatearMoneda(precioUnitarioConIVA * inv.cantidad);
    });

    // ---------- CFE ----------
    const cfeBase = datosCotizacion.CFE * factor;
    subtotalBase += cfeBase;
    const cfeConIVA = cfeBase * factorIVA;
    document.getElementById("precio-unitario-cfe").textContent = formatearMoneda(cfeConIVA);
    document.getElementById("subtotal-cfe").textContent = formatearMoneda(cfeConIVA);

    // ---------- BOS ----------
    const bosBase = datosCotizacion.BOS * factor;
    subtotalBase += panelesNecesarios * bosBase;
    const bosConIVA = bosBase * factorIVA;
    document.getElementById("precio-unitario-bos").textContent = formatearMoneda(bosConIVA);
    document.getElementById("subtotal-bos").textContent = formatearMoneda(panelesNecesarios * bosConIVA);

    // ---------- Obra ----------
    const obraBase = datosCotizacion.Obra * factor;
    subtotalBase += panelesNecesarios * obraBase;
    const obraConIVA = obraBase * factorIVA;
    document.getElementById("precio-unitario-obra").textContent = formatearMoneda(obraConIVA);
    document.getElementById("subtotal-obra").textContent = formatearMoneda(panelesNecesarios * obraConIVA);

    // ---------- Estructura ----------
    const estructuraBase = datosCotizacion.Estructura * factor;
    subtotalBase += panelesNecesarios * estructuraBase;
    const estructuraConIVA = estructuraBase * factorIVA;
    document.getElementById("precio-unitario-estructura").textContent = formatearMoneda(estructuraConIVA);
    document.getElementById("subtotal-estructura").textContent = formatearMoneda(panelesNecesarios * estructuraConIVA);

    // ---------- Obra Eléctrica ----------
    const obraElectricaBase = datosCotizacion.ObraElectrica * factor;
    subtotalBase += panelesNecesarios * obraElectricaBase;
    const obraElectricaConIVA = obraElectricaBase * factorIVA;
    document.getElementById("precio-unitario-obra-electrica").textContent = formatearMoneda(obraElectricaConIVA);
    document.getElementById("subtotal-obra-electrica").textContent = formatearMoneda(panelesNecesarios * obraElectricaConIVA);

    // ---------- Batería (si aplica) ----------
    if (bateriaSelect.value === "si") {
      const bateriaBase = PRECIO_BATERIA * factor;
      const cantidadBateria = parseInt(document.getElementById("cantidad-bateria").value) || 1;
      subtotalBase += bateriaBase * cantidadBateria;
      const bateriaConIVA = bateriaBase * factorIVA;
      document.getElementById("precio-unitario-bateria").textContent = formatearMoneda(bateriaConIVA);
      document.getElementById("subtotal-bateria").textContent = formatearMoneda(bateriaConIVA * cantidadBateria);
    }

    // ---------- Campos extra (retornan base sin IVA) ----------
    const totalExtraBase = calcularTotalExtra(factorIVA);
    subtotalBase += totalExtraBase;

    // ---------- Cálculo de IVA y total ----------
    const iva = subtotalBase * 0.16;
    const totalConIVA = subtotalBase * 1.16;

    // Actualizar UI de totales
    actualizarUITotales(
      incluirIVA ? totalConIVA : subtotalBase, // Si incluye IVA, mostrar el total como "subtotal"
      incluirIVA ? 0 : iva,                    // Si incluye IVA, no mostrar IVA por separado
      totalConIVA                               // El total siempre es el mismo
    );

    // Actualizar costo promedio por panel
    const nuevoPanelPromedio = totalConIVA / panelesNecesarios;
    document.querySelectorAll("#panelPromedio").forEach(element => {
      element.textContent = formatearMoneda(nuevoPanelPromedio);
    });

    // Actualizar caché
    ultimoSubtotal = subtotalBase;
    ultimoIVA = iva;
    ultimoTotal = totalConIVA;

    // Actualizar sugeridos
    const textoInversores = inversoresSeleccionados
      .map(inv => `${inv.cantidad} x ${limpiarModelo(inv.modelo)}`)
      .join(", ");

    const sugeridos = document.getElementById("inversoresSugeridos");
    if (sugeridos) sugeridos.innerHTML = `<strong>Inversores sugeridos:</strong> ${textoInversores}`;

    isCalculating = false;
  }

  // Función para mostrar ROI
  function mostrarROI() {
    const inputClave = document.getElementById("claveDescuento");
    if (!inputClave || !inputClave.value.trim()) {
      descuentoActual = 0;
      actualizarTotales();
    }
    
    if (roiSection) {
      roiSection.style.display = "block";
      roiSection.scrollIntoView({ behavior: "smooth" });
    }
    
    document.getElementById("btnVerDetalles")?.remove();
    document.getElementById("btnCotizacionPDF")?.remove();
    document.getElementById("btnROI")?.remove();
    document.getElementById("btnOcultarDetalles")?.remove();

    const pagoBimestral = parseFloat(document.getElementById("pago")?.value);
    let precioRealKwh;
    const consumo = parseFloat(consumoInput.value);

    if (!isNaN(pagoBimestral) && pagoBimestral > 0) {
      precioRealKwh = pagoBimestral / consumo;
    } else {
      const costoCFE = obtenerCostoTotalCFE(consumo);
      precioRealKwh = costoCFE / consumo;
    }

    let valorTotalMostrado = parseFloat(
      document.getElementById("total-amount").textContent.replace(/[^\d.-]+/g, "")
    );
    if (btnPDF.dataset.total) {
      valorTotalMostrado = parseFloat(btnPDF.dataset.total);
    }

    const energiaMensual = datosCotizacion.energiaBimestral / 2 || 0;
    calcularROI(valorTotalMostrado, energiaMensual, precioRealKwh);
  }

  // Función para calcular el financiamiento
function calcularFinanciamiento() {
    const totalSistema = parseFloat(btnPDF.dataset.total) || ultimoTotal;
    const consumoBimestral = parseFloat(consumoInput.value);
    
    document.getElementById("btnPDF")?.remove();
    document.getElementById("btnFinanciamiento")?.remove();

    const pagoBimestral = parseFloat(document.getElementById("pago")?.value);
    let precioKwhROI;

    if (!isNaN(pagoBimestral) && pagoBimestral > 0) {
      precioKwhROI = pagoBimestral / consumoBimestral;
    } else {
      const costoCFE = obtenerCostoTotalCFE(consumoBimestral);
      precioKwhROI = costoCFE / consumoBimestral;
    }

    const energiaBimestral = datosCotizacion.energiaBimestral || 0;
    const ahorroMensual = calcularAhorroMensual(energiaBimestral, precioKwhROI);

    const financiamientoSection = document.createElement('div');
    financiamientoSection.id = 'financiamientoSection';
    financiamientoSection.style.marginTop = '0rem';

    function actualizarPagoInicial() {
        const enganche = parseFloat(document.getElementById('engancheMontoInput').value.replace(/[$,]/g, '')) || 0;
        const excluirMantenimiento = document.getElementById('excluirMantenimiento').checked;
        const incluirMantenimientoMensual = document.getElementById('incluirMantenimientoMensual').checked;
        
        let mantenimiento = 0;
        let equipoMonitoreo = 0;
        
        if (!excluirMantenimiento && !incluirMantenimientoMensual) {
            mantenimiento = (panelesNecesarios * 250) * 1.16;
            equipoMonitoreo = 1500 * 1.16;
        }
        
        document.getElementById('mantenimientoExcluido').style.display = excluirMantenimiento ? 'inline' : 'none';
        document.getElementById('monitoreoExcluido').style.display = excluirMantenimiento ? 'inline' : 'none';
        document.getElementById('mantenimientoIncluidoMensual').style.display = incluirMantenimientoMensual ? 'inline' : 'none';
        document.getElementById('monitoreoIncluidoMensual').style.display = incluirMantenimientoMensual ? 'inline' : 'none';
        
        engancheInicial = enganche;
        const pagoInicial = engancheInicial + mantenimiento + equipoMonitoreo;

        const pagoInicialSpan = document.getElementById('pagoInicialDisplay');
        if(pagoInicialSpan) {
            pagoInicialSpan.textContent = formatearMoneda(pagoInicial);
        }
        
        return { pagoInicial, mantenimiento, equipoMonitoreo };
    }
    
    financiamientoSection.id = "financiamientoSection";
    financiamientoSection.style.width = "100%";
    financiamientoSection.style.maxWidth = "1200px";
    financiamientoSection.style.margin = "0 auto";
    financiamientoSection.style.padding = "-1rem";
    financiamientoSection.style.boxSizing = "border-box";
    
    financiamientoSection.innerHTML = `
        <div class="financiamiento-container" 
            style="background:#fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); margin-top: 1rem;">
            
            <h2 style="text-align: center; font-size: 2.5rem; font-weight: bold; margin-bottom: 0rem;">Plan de Pagos a Meses</h2>
            
            <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: .5rem; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; cursor: pointer; padding: 0.5rem 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                    <input type="checkbox" id="excluirMantenimiento" style="margin-right: 8px; transform: scale(1.2);">
                    <strong>Excluir Mantenimiento y Monitoreo</strong>
                </label>
                <label style="display: flex; align-items: center; cursor: pointer; padding: 0.5rem 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                    <input type="checkbox" id="incluirMantenimientoMensual" style="margin-right: 8px; transform: scale(1.2);">
                    <strong>Incluir Mantenimiento en Mensualidad</strong>
                </label>
            </div>
            
            <div class="form-section" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap:  1rem; width: 100%; box-sizing: border-box;">

                <div class="form-column" style="flex: 1; min-width: 300px;">
                    <div class="input-group">
                        <label for="plazoMeses">Plazo (meses):</label>
                        <select id="plazoMeses">
                            <option value="12">12 meses</option>
                            <option value="18">18 meses</option>
                            <option value="24" selected>24 meses</option>
                            <option value="36">36 meses</option>
                            <option value="48">48 meses</option>
                            <option value="60">60 meses</option>
                        </select>
                    </div>
                    
                    <div class="input-group">
                        <label for="mensualidadInput">Mensualidad de:</label>
                        <input type="text" id="mensualidadInput" placeholder="$0.00">
                    </div>
                </div>
                
                <div class="form-column" style="flex: 1; min-width: 300px;">
                    <div class="input-group">
                        <label for="engancheInput">Porcentaje de Enganche:</label>
                        <input type="number" id="engancheInput" min="0" max="100" value="30" step="5">
                    </div>
                    
                    <div class="input-group">
                        <label for="engancheMontoInput">Monto de Enganche:</label>
                        <input type="text" id="engancheMontoInput" placeholder="$0.00" readonly>
                    </div>
                </div>
            </div>
            
            <div class="tabla-responsive">
                <table id="financiamientoTable" style="width: 110%;">
                    <thead>
                        <tr>
                            <th>Mes</th>
                            <th>Interés</th>
                            <th>Capital</th>
                            <th>Saldo Restante</th>
                            <th>Pago Mensual</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
                
<div style="width: 100%; max-width: 900px; margin: 1.5rem auto;">

  <div style="margin-bottom: 1rem; padding: 1rem; background-color: #e3f2fd; border-radius: 10px; border-left: 4px solid #1976d2;">
    <div style="display: flex; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 300px; padding-right: 20px;">
        <p style="margin: 0.75rem 0;"><strong>Total Costo del sistema:</strong> <span id="totalSistemaDisplay">${formatearMoneda(totalSistema)}</span></p>
        <p style="margin: 0.75rem 0;"><strong>Enganche Inicial:</strong> <span id="engancheMontoSpan"></span></p>
        <p style="margin: 0.75rem 0;"><strong>Monto a Pagar a Meses:</strong> <span id="totalFinanciado"></span></p>
        <p style="margin: 0.75rem 0;"><strong>Ahorro estimado en electricidad:</strong> ${formatearMoneda(ahorroMensual)}</p>
        <p style="margin: 0.75rem 0;">
          <strong>Pago Inicial:</strong> 
          <span id="pagoInicialDisplay" style="color: #fff; background:#007bff; font-weight: bold; padding: 4px 8px; border-radius: 4px;">
            ${formatearMoneda((panelesNecesarios * 250) * 1.16 + 1500 * 1.16 + (totalSistema * 0.3))}
          </span>
        </p>
      </div>
      
      <div style="flex: 1; min-width: 250px;">
        <p style="margin: 0.5rem 0;">
          <strong>Mantenimiento + Monitoreo anual:</strong> 
          <span id="mantenimientoDisplay">${formatearMoneda((panelesNecesarios*250)*1.16)}</span>
          <span id="mantenimientoExcluido" style="color: #dc3545; font-weight: bold; display: none;"> (Excluido)</span>
          <span id="mantenimientoIncluidoMensual" style="color: #28a745; font-weight: bold; display: none;"> (Incluido en mensualidad)</span>
        </p>
        <p style="margin: 0.5rem 0;">
          <strong>Equipo de Monitoreo (Un solo pago):</strong> 
          <span id="monitoreoDisplay">${formatearMoneda(1500*1.16)}</span>
          <span id="monitoreoExcluido" style="color: #dc3545; font-weight: bold; display: none;"> (Excluido)</span>
          <span id="monitoreoIncluidoMensual" style="color: #28a745; font-weight: bold; display: none;"> (Incluido en mensualidad)</span>
        </p>
        <p style="margin: 0.75rem 0;">
          <strong>Mensualidad fija:</strong> 
          <span id="mensualidadFija" style="background: #007bff; color: #fff; font-weight: bold; padding: 4px 8px; border-radius: 4px;"></span>
        </p>
      </div>
    </div>
  </div>

  <div style="margin-bottom: 1.5rem; padding: 1.5rem; background-color: #fff3e0; border-left: 4px solid #ff9800; border-radius: 10px; font-size: 0.95rem; line-height: 1.5;">
    <p id="textoPagosProgramados"><strong>Pagos programados:</strong> Los pagos de mantenimiento se aplicarán en meses específicos según el plazo seleccionado.</p>
    <p><strong>El mantenimiento incluye: </strong> limpieza de los paneles solares una vez al año, retoque de impermeabilizante de las bases de la estructura, revisión de cableado (falsos contactos o desgastados), estructura y fusibles.</p> 
    <p><strong>El monitoreo incluye:</strong> dar un seguimiento diario del desempeño de los paneles solares, detectar posibles caídas en la producción y prevenir fallos ocasionados por suciedad, sombreado u otras incidencias en el sistema.</p>
    <p>El pago por Equipo de Monitoreo es un <strong>único pago</strong>.</p>
  </div>

  <div style="margin-bottom: 1.5rem; padding: 1.5rem; background-color: #e8f5e9; border-left: 4px solid #388e3c; border-radius: 10px; font-size: 0.95rem; line-height: 1.5;">
    <h4 style="margin-top: 0; color: #1b5e20; font-size: 1.1rem;">Comparación Mensual: Ahorro vs Pago de Paneles</h4>
    
    <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; margin-bottom: 1rem;">
      <div style="flex: 1; min-width: 220px; background-color: #e8f5e9; border-radius: 8px; padding: 1rem; text-align: center; border-left: 4px solid #4caf50;">
        <p style="margin: 0; font-weight: 600; color: #155724;">Ahorro mensual en electricidad</p>
        <p style="font-size: 1.2rem; color: #28a745; font-weight: bold;" id="ahorroMensualDisplay">${formatearMoneda(ahorroMensual)}</p>
      </div>

      <div style="flex: 1; min-width: 220px; background-color: #ffebee; border-radius: 8px; padding: 1rem; text-align: center; border-left: 4px solid #f44336;">
        <p style="margin: 0; font-weight: 600; color: #721c24;">Mensualidad de paneles solares</p>
        <p style="font-size: 1.2rem; color: #dc3545; font-weight: bold;" id="mensualidadPanelesDisplay">${formatearMoneda(0)}</p>
        <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #721c24;">Financiamiento a <span id="mesesFinanciamiento">24</span> meses</p>
      </div>

      <div style="flex: 1; min-width: 220px; background-color: #fffde7; border-radius: 8px; padding: 1rem; text-align: center; border-left: 4px solid #ffeb3b;">
        <p style="margin: 0; font-weight: 600; color: #856404;">Porcentaje de ahorro</p>
        <p style="font-size: 1.2rem; color: #ff9800; font-weight: bold;" id="porcentajeAhorroDisplay">--%</p>
      </div>
    </div>

    <div id="resultadoComparacion" style="padding: 1rem; background-color: #f3e5f5; border-radius: 8px; text-align: center; font-weight: bold; font-size: 1rem; border-left: 4px solid #9c27b0;">
    </div>
  </div>

  <div id="botonesFinanciamiento" style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">
    <button id="btnPDFFinanciamiento" class="boton" style="flex: 1; min-width: 200px; max-width: 250px; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 8px; font-weight: bold;">Generar PDF</button>
    <button id="btnRegresarInicio" class="boton" style="flex: 1; min-width: 200px; max-width: 250px; padding: 12px; background-color: #6c757d; color: white; border: none; border-radius: 8px; font-weight: bold;">Regresar a inicio</button>
  </div>

</div>


    `;

    const financiamientoContainer = document.getElementById('financiamientoContainer');
    financiamientoContainer.style.display = 'block';
    financiamientoContainer.innerHTML = '';
    financiamientoContainer.appendChild(financiamientoSection);
    
    actualizarFinanciamiento(ahorroMensual);
    actualizarPagoInicial();
    
    document.getElementById('excluirMantenimiento').addEventListener('change', function() {
        if (this.checked) {
            document.getElementById('incluirMantenimientoMensual').checked = false;
        }
        actualizarFinanciamiento(ahorroMensual);
        actualizarPagoInicial();
    });
    
    document.getElementById('incluirMantenimientoMensual').addEventListener('change', function() {
        if (this.checked) {
            document.getElementById('excluirMantenimiento').checked = false;
        }
        actualizarFinanciamiento(ahorroMensual);
        actualizarPagoInicial();
    });
    
    document.getElementById('engancheInput').addEventListener('input', function() {
        actualizarFinanciamiento(ahorroMensual);
        actualizarPagoInicial();
    });
    
    document.getElementById('mensualidadInput').addEventListener('input', function() {
        actualizarDesdeMensualidad(ahorroMensual);
        actualizarPagoInicial();
    });
    
    document.getElementById('plazoMeses').addEventListener('change', function() {
        actualizarFinanciamiento(ahorroMensual);
        actualizarPagoInicial();
    });
    
    document.getElementById('btnPDFFinanciamiento').addEventListener('click', () => {
        generarPDF("financiamiento_nahi.pdf", false, true);
    });
    
    document.getElementById('btnRegresarInicio').addEventListener('click', () => {
        window.location.reload();
    });
}

  // Función para actualizar la comparación mensual
  function actualizarComparacionMensual(ahorroMensual, mensualidadPaneles) {
    const diferencia = ahorroMensual - mensualidadPaneles;
    const resultadoComparacion = document.getElementById('resultadoComparacion');
    const porcentajeAhorroDisplay = document.getElementById('porcentajeAhorroDisplay');
    
    if (!resultadoComparacion || !porcentajeAhorroDisplay) return;
    
    let porcentaje = 0;
    if (mensualidadPaneles > 0) {
      porcentaje = ((ahorroMensual - mensualidadPaneles) / mensualidadPaneles) * 100;
    }
    
    if (porcentaje > 0) {
      porcentajeAhorroDisplay.textContent = `${porcentaje.toFixed(1)}%`;
      porcentajeAhorroDisplay.style.color = '#28a745';
    } else if (porcentaje < 0) {
      porcentajeAhorroDisplay.textContent = `${Math.abs(porcentaje).toFixed(1)}%`;
      porcentajeAhorroDisplay.style.color = '#dc3545';
    } else {
      porcentajeAhorroDisplay.textContent = '0%';
      porcentajeAhorroDisplay.style.color = '#6c757d';
    }
    
    if (diferencia > 0) {
      resultadoComparacion.innerHTML = `
          <span style="color: #28a745;"> Estás AHORRANDO </span>
          <span style="color: #28a745; font-size: 1.1rem;">${formatearMoneda(Math.abs(diferencia))} por mes</span>
          <br>
          <span style="font-size: 0.9rem; color: #155724;">Tu ahorro en electricidad cubre la mensualidad y te sobra dinero</span>
      `;
      resultadoComparacion.style.backgroundColor = '#d4edda';
      resultadoComparacion.style.border = '1px solid #c3e6cb';
    } else if (diferencia < 0) {
      resultadoComparacion.innerHTML = `
          <span style="color: #dc3545;">⚠ Debes PAGAR EXTRA </span>
          <span style="color: #dc3545; font-size: 1.1rem;">${formatearMoneda(Math.abs(diferencia))} por mes</span>
          <br>
          <span style="font-size: 0.9rem; color: #721c24;">Tu ahorro en electricidad no cubre completamente la mensualidad</span>
      `;
      resultadoComparacion.style.backgroundColor = '#f8d7da';
      resultadoComparacion.style.border = '1px solid #f5c6cb';
    } else {
      resultadoComparacion.innerHTML = `
          <span style="color: #856404;">• Estás en EQUILIBRIO </span>
          <span style="color: #856404; font-size: 1.1rem;">$0 diferencia</span>
          <br>
          <span style="font-size: 0.9rem; color: #856404;">Tu ahorro en electricidad cubre exactamente la mensualidad</span>
      `;
      resultadoComparacion.style.backgroundColor = '#fff3cd';
      resultadoComparacion.style.border = '1px solid #ffeaa7';
    }
  }

  // Función para actualizar el financiamiento
  function actualizarFinanciamiento(ahorroMensual) {
    const totalSistema = ultimoTotal;
    const engancheInput = document.getElementById('engancheInput');
    const enganchePorcentaje = parseFloat(engancheInput.value) || 0;
    const plazoMeses = parseInt(document.getElementById('plazoMeses').value) || 24;
    const incluirMantenimientoMensual = document.getElementById('incluirMantenimientoMensual').checked;
    
    if (enganchePorcentaje < 0) engancheInput.value = 0;
    if (enganchePorcentaje > 100) engancheInput.value = 100;
    
    const enganche = totalSistema * (enganchePorcentaje / 100);
    let saldoFinanciar = totalSistema - enganche;
    
    if (incluirMantenimientoMensual) {
        const mantenimientoTotal = (panelesNecesarios * 250 * 2) * 1.16;
        const equipoMonitoreo = 1500 * 1.16;
        saldoFinanciar += mantenimientoTotal + equipoMonitoreo;
    }
    
    document.getElementById('engancheMontoInput').value = formatearMoneda(enganche);
    document.getElementById('engancheMontoSpan').textContent = formatearMoneda(enganche);
    document.getElementById('totalFinanciado').textContent = formatearMoneda(saldoFinanciar);
    
    document.getElementById('mesesFinanciamiento').textContent = plazoMeses;
    
    const tasaMensual = 0.02;
    const factor = Math.pow(1 + tasaMensual, plazoMeses);
    const mensualidad = saldoFinanciar * (tasaMensual * factor) / (factor - 1);
    
    document.getElementById('mensualidadFija').textContent = formatearMoneda(mensualidad);
    document.getElementById('mensualidadInput').value = formatearMoneda(mensualidad);
    document.getElementById('mensualidadPanelesDisplay').textContent = formatearMoneda(mensualidad);
    
    document.getElementById('ahorroMensualDisplay').textContent = formatearMoneda(ahorroMensual);

    const pagosProgramados = document.querySelectorAll('.pago-programado');
    pagosProgramados.forEach(span => {
        span.textContent = formatearMoneda(mensualidad);
    });
    
    generarTablaFinanciamiento(saldoFinanciar, mensualidad, plazoMeses);
    actualizarComparacionMensual(ahorroMensual, mensualidad);
  }

  // Función para actualizar desde la mensualidad deseada
  function actualizarDesdeMensualidad(ahorroMensual) {
    const totalSistema = parseFloat(btnPDF.dataset.total) || ultimoTotal;
    const mensualidadInput = document.getElementById('mensualidadInput');
    let mensualidadDeseada = parseFloat(mensualidadInput.value.replace(/[^\d.-]+/g, '')) || 0;
    const plazoMeses = parseInt(document.getElementById('plazoMeses').value) || 24;
    const incluirMantenimientoMensual = document.getElementById('incluirMantenimientoMensual').checked;
    
    if (mensualidadDeseada <= 0) return;
    
    document.getElementById('mesesFinanciamiento').textContent = plazoMeses;
    
    const tasaMensual = 0.02;
    const n = plazoMeses;
    
    const factor = Math.pow(1 + tasaMensual, n);
    const saldoFinanciable = mensualidadDeseada * (factor - 1) / (tasaMensual * factor);
    
    let enganche = totalSistema - saldoFinanciable;
    
    if (incluirMantenimientoMensual) {
        const mantenimientoTotal = (panelesNecesarios * 250 * 2) * 1.16;
        const equipoMonitoreo = 1500 * 1.16;
        enganche = (totalSistema + mantenimientoTotal + equipoMonitoreo) - saldoFinanciable;
    }
    
    const enganchePorcentaje = (enganche / totalSistema) * 100;
    
    document.getElementById('engancheInput').value = enganchePorcentaje.toFixed(0);
    document.getElementById('engancheMontoInput').value = formatearMoneda(enganche);
    document.getElementById('engancheMontoSpan').textContent = formatearMoneda(enganche);
    document.getElementById('totalFinanciado').textContent = formatearMoneda(saldoFinanciable);
    document.getElementById('mensualidadFija').textContent = formatearMoneda(mensualidadDeseada);
    document.getElementById('mensualidadPanelesDisplay').textContent = formatearMoneda(mensualidadDeseada);
    
    document.getElementById('ahorroMensualDisplay').textContent = formatearMoneda(ahorroMensual);
    
    generarTablaFinanciamiento(saldoFinanciable, mensualidadDeseada, plazoMeses);
    actualizarComparacionMensual(ahorroMensual, mensualidadDeseada);
  }

  // Función para generar la tabla de amortización
function generarTablaFinanciamiento(saldoFinanciar, mensualidad, plazoMeses) {
  const tbody = document.querySelector('#financiamientoTable tbody');
  tbody.innerHTML = '';
  
  let saldo = saldoFinanciar;
  const tasaMensual = 0.02;
  
  const excluirMantenimiento = document.getElementById('excluirMantenimiento').checked;
  const incluirMantenimientoMensual = document.getElementById('incluirMantenimientoMensual').checked;
  
  const mantenimientoAnual = excluirMantenimiento ? 0 : (panelesNecesarios * 250) * 1.16;
  
  for (let mes = 1; mes <= plazoMeses; mes++) {
    const interes = saldo * tasaMensual;
    const capital = mensualidad - interes;
    saldo -= capital;
    
    const saldoFinal = mes === plazoMeses ? 0 : Math.max(0, saldo);
    
    let pagoMensualTotal = mensualidad;
    let tieneMantenimiento = false;
    
    if (!excluirMantenimiento && !incluirMantenimientoMensual) {
      if (plazoMeses === 24) {
        if (mes === 13) {
          pagoMensualTotal = mensualidad + mantenimientoAnual;
          tieneMantenimiento = true;
        }
      } else if (plazoMeses === 36) {
        if (mes === 13 || mes === 25) {
          pagoMensualTotal = mensualidad + mantenimientoAnual;
          tieneMantenimiento = true;
        }
      } else if (plazoMeses === 48) {
        if (mes === 13 || mes === 25 || mes === 37) {
          pagoMensualTotal = mensualidad + mantenimientoAnual;
          tieneMantenimiento = true;
        }
        } else if (plazoMeses === 60) {
        if (mes === 13 || mes === 25 || mes === 37 || mes === 49) {
          pagoMensualTotal = mensualidad + mantenimientoAnual;
          tieneMantenimiento = true;
        }
      }
    }
    
    const row = document.createElement('tr');
    
    if (tieneMantenimiento) {
      row.style.backgroundColor = '#fff7e6';
      row.innerHTML = `
          <td><strong>${mes}</strong> <span style="color: #ffa500; font-size: 0.8rem;">★</span></td>
          <td>${formatearMoneda(interes)}</td>
          <td>${formatearMoneda(capital)}</td>
          <td>${saldoFinal > 0 ? formatearMoneda(saldoFinal) : '$0'}</td>
          <td><strong>${formatearMoneda(pagoMensualTotal)}</strong></td>
      `;
    } else {
      row.innerHTML = `
          <td>${mes}</td>
          <td>${formatearMoneda(interes)}</td>
          <td>${formatearMoneda(capital)}</td>
          <td>${saldoFinal > 0 ? formatearMoneda(saldoFinal) : '$0'}</td>
          <td>${formatearMoneda(pagoMensualTotal)}</td>
      `;
    }
    
    tbody.appendChild(row);
    
    saldo = saldoFinal;
  }
  
  actualizarTextoPagosProgramados(plazoMeses, mensualidad, mantenimientoAnual);
}

function actualizarTextoPagosProgramados(plazoMeses, mensualidad, mantenimientoAnual) {
  const excluirMantenimiento = document.getElementById('excluirMantenimiento').checked;
  const incluirMantenimientoMensual = document.getElementById('incluirMantenimientoMensual').checked;
  const textoMantenimiento = formatearMoneda(mantenimientoAnual);
  
  let textoDescriptivo = '';
  
  if (excluirMantenimiento) {
    textoDescriptivo = `No se incluyen pagos de mantenimiento y monitoreo en el financiamiento. El pago mensual será únicamente de <strong>${formatearMoneda(mensualidad)}</strong>.`;
  } else if (incluirMantenimientoMensual) {
    textoDescriptivo = `El mantenimiento y monitoreo están incluidos en la mensualidad de <strong>${formatearMoneda(mensualidad)}</strong>. No hay pagos adicionales de mantenimiento.`;
  } else {
if (plazoMeses === 18) {
          textoDescriptivo = `En el mes 13, el pago será de <strong>${formatearMoneda(mensualidad + mantenimientoAnual)}</strong> (${formatearMoneda(mensualidad)} de mensualidad + ${textoMantenimiento} de mantenimiento). En los demás meses, el pago será únicamente de <strong>${formatearMoneda(mensualidad)}</strong>.`;
}
    else if (plazoMeses === 24) {
      textoDescriptivo = `En el mes 13, el pago será de <strong>${formatearMoneda(mensualidad + mantenimientoAnual)}</strong> (${formatearMoneda(mensualidad)} de mensualidad + ${textoMantenimiento} de mantenimiento). En los demás meses, el pago será únicamente de <strong>${formatearMoneda(mensualidad)}</strong>.`;
    } else if (plazoMeses === 36) {
      textoDescriptivo = `En los meses 13 y 25, el pago será de <strong>${formatearMoneda(mensualidad + mantenimientoAnual)}</strong> (${formatearMoneda(mensualidad)} de mensualidad + ${textoMantenimiento} de mantenimiento). En los demás meses, el pago será únicamente de <strong>${formatearMoneda(mensualidad)}</strong>.`;
    } else if (plazoMeses === 48) {
      textoDescriptivo = `En los meses 13, 25 y 37, el pago será de <strong>${formatearMoneda(mensualidad + mantenimientoAnual)}</strong> (${formatearMoneda(mensualidad)} de mensualidad + ${textoMantenimiento} de mantenimiento). En los demás meses, el pago será únicamente de <strong>${formatearMoneda(mensualidad)}</strong>.`;
    } else if (plazoMeses === 60) {
      textoDescriptivo = `En los meses 13, 25, 37 y 49, el pago será de <strong>${formatearMoneda(mensualidad + mantenimientoAnual)}</strong> (${formatearMoneda(mensualidad)} de mensualidad + ${textoMantenimiento} de mantenimiento). En los demás meses, el pago será únicamente de <strong>${formatearMoneda(mensualidad)}</strong>.`;
    } else {
      textoDescriptivo = `En los demás meses, el pago será únicamente de <strong>${formatearMoneda(mensualidad)}</strong>.`;
    }
  }
  
  const seccionPagosProgramados = document.querySelector('#financiamientoSection div[style*="background-color: #fff7e6"] p');
  if (seccionPagosProgramados) {
    seccionPagosProgramados.innerHTML = `<strong>Pagos programados:</strong> ${textoDescriptivo}`;
  }
  
  const spansPagoProgramado = document.querySelectorAll('.pago-programado');
  spansPagoProgramado.forEach(span => {
    span.textContent = formatearMoneda(mensualidad);
  });
}

  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'plazoMeses') {
      const ahorroMensual = parseFloat(
        document.getElementById('ahorroMensualDisplay')?.textContent?.replace(/[^\d.-]+/g, '') || 0
      );
      if (ahorroMensual > 0) {
        actualizarFinanciamiento(ahorroMensual);
      }
    }
  });

  document.addEventListener('click', function(e) {
    if (e.target.id === 'btnFinanciamiento') {
      const existingSection = document.getElementById('financiamientoSection');
      if (existingSection) existingSection.remove();
      
      calcularFinanciamiento();
    }
  });
});
