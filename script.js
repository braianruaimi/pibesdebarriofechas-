const bookingForm = document.getElementById('bookingForm');
const installPanel = document.getElementById('installPanel');
const installButton = document.getElementById('installButton');
const iosInstallHint = document.getElementById('iosInstallHint');
const reservationModal = document.getElementById('reservationModal');
const reservationClose = document.getElementById('reservationClose');
const continueWhatsappButton = document.getElementById('continueWhatsappButton');
const downloadQrButton = document.getElementById('downloadQrButton');
const reservationCode = document.getElementById('reservationCode');
const reservationName = document.getElementById('reservationName');
const reservationInstagram = document.getElementById('reservationInstagram');
const reservationDate = document.getElementById('reservationDate');
const reservationGuests = document.getElementById('reservationGuests');
const reservationTable = document.getElementById('reservationTable');
const reservationTableNote = document.getElementById('reservationTableNote');
const reservationSignature = document.getElementById('reservationSignature');
const reservationQrContainer = document.getElementById('reservationQr');
const mesaField = document.getElementById('mesa');
const mesaNotice = document.getElementById('mesaNotice');
const RESERVATION_STORAGE_KEY = 'pibes-de-barrio:last-reservation';
let deferredInstallPrompt;
let hasEngaged = false;
let pendingWhatsappUrl = '';
let qrInstance;
let qrDownloadDataUrl = '';

const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isAndroid = /android/i.test(window.navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const openReservationModal = () => {
  if (!reservationModal) {
    return;
  }

  reservationModal.hidden = false;
  document.body.style.overflow = 'hidden';
};

const closeReservationModal = () => {
  if (!reservationModal) {
    return;
  }

  reservationModal.hidden = true;
  document.body.style.overflow = '';
};

const persistReservation = (reservationData) => {
  try {
    window.localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify(reservationData));
  } catch {
    return null;
  }

  return reservationData;
};

const readPersistedReservation = () => {
  try {
    const rawReservation = window.localStorage.getItem(RESERVATION_STORAGE_KEY);

    if (!rawReservation) {
      return null;
    }

    return JSON.parse(rawReservation);
  } catch {
    return null;
  }
};

const clearPersistedReservation = () => {
  try {
    window.localStorage.removeItem(RESERVATION_STORAGE_KEY);
  } catch {
    return null;
  }
};

const buildReservationCode = (nombre) => {
  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('');
  const stamp = Date.now().toString().slice(-6);
  return `PDB-${initials || 'RS'}${stamp}`;
};

const buildReservationSignature = (payload) => {
  let hash = 2166136261;

  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const normalizedHash = (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `SIG-${normalizedHash}`;
};

const renderReservationQr = (payload) => {
  if (!reservationQrContainer || typeof QRCode === 'undefined') {
    return;
  }

  reservationQrContainer.innerHTML = '';

  qrInstance = new QRCode(reservationQrContainer, {
    text: payload,
    width: 220,
    height: 220,
    colorDark: '#0a0a0c',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  window.requestAnimationFrame(() => {
    const generatedImage = reservationQrContainer.querySelector('img');
    const generatedCanvas = reservationQrContainer.querySelector('canvas');

    if (generatedImage?.src) {
      qrDownloadDataUrl = generatedImage.src;
      return;
    }

    if (generatedCanvas) {
      qrDownloadDataUrl = generatedCanvas.toDataURL('image/png');
      return;
    }

    qrDownloadDataUrl = '';
  });
};

const paintReservationTicket = (reservationData) => {
  if (reservationCode) {
    reservationCode.textContent = reservationData.reservaId;
  }

  if (reservationName) {
    reservationName.textContent = reservationData.nombre;
  }

  if (reservationInstagram) {
    reservationInstagram.textContent = reservationData.instagram;
  }

  if (reservationDate) {
    reservationDate.textContent = reservationData.fecha;
  }

  if (reservationGuests) {
    reservationGuests.textContent = reservationData.personas;
  }

  if (reservationTable) {
    reservationTable.textContent = reservationData.mesa || 'No';
  }

  if (reservationTableNote) {
    reservationTableNote.hidden = reservationData.mesa !== 'Si';
  }

  if (reservationSignature) {
    reservationSignature.textContent = reservationData.firmaReserva;
  }

  renderReservationQr(reservationData.reservationPayload);
};

const downloadReservationQr = () => {
  if (!qrDownloadDataUrl) {
    const generatedImage = reservationQrContainer?.querySelector('img');
    const generatedCanvas = reservationQrContainer?.querySelector('canvas');

    if (generatedImage?.src) {
      qrDownloadDataUrl = generatedImage.src;
    } else if (generatedCanvas) {
      qrDownloadDataUrl = generatedCanvas.toDataURL('image/png');
    }
  }

  if (!qrDownloadDataUrl) {
    return;
  }

  const downloadLink = document.createElement('a');
  downloadLink.href = qrDownloadDataUrl;
  downloadLink.download = `${reservationCode?.textContent || 'reserva-pibes'}.png`;
  downloadLink.click();
};

const waitForQrDownloadData = () => new Promise((resolve) => {
  let attempts = 0;

  const syncData = () => {
    attempts += 1;

    if (!qrDownloadDataUrl) {
      const generatedImage = reservationQrContainer?.querySelector('img');
      const generatedCanvas = reservationQrContainer?.querySelector('canvas');

      if (generatedImage?.src) {
        qrDownloadDataUrl = generatedImage.src;
      } else if (generatedCanvas) {
        qrDownloadDataUrl = generatedCanvas.toDataURL('image/png');
      }
    }

    if (qrDownloadDataUrl || attempts >= 8) {
      resolve();
      return;
    }

    window.requestAnimationFrame(syncData);
  };

  syncData();
});

const setEngagedState = () => {
  if (hasEngaged) {
    return;
  }

  hasEngaged = true;
  document.body.classList.add('is-engaged');
};

const syncScrolledState = () => {
  document.body.classList.toggle('is-scrolled', window.scrollY > 18);

  if (window.scrollY > 18) {
    setEngagedState();
  }
};

if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      return null;
    });
  });
}

['pointerdown', 'touchstart', 'keydown', 'focusin', 'wheel'].forEach((eventName) => {
  window.addEventListener(eventName, setEngagedState, { passive: true, once: true });
});

window.addEventListener('scroll', syncScrolledState, { passive: true });
syncScrolledState();

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;

  if (installPanel) {
    installPanel.hidden = false;
  }
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;

  if (installPanel) {
    installPanel.hidden = true;
  }
});

if (isIos && !isStandalone && iosInstallHint) {
  iosInstallHint.hidden = false;
}

if (installButton) {
  installButton.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installPanel.hidden = true;
      return;
    }

    if (isIos && iosInstallHint) {
      iosInstallHint.hidden = false;
      iosInstallHint.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (reservationClose) {
  reservationClose.addEventListener('click', closeReservationModal);
}

if (reservationModal) {
  reservationModal.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.hasAttribute('data-close-reservation')) {
      closeReservationModal();
    }
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && reservationModal && !reservationModal.hidden) {
    closeReservationModal();
  }
});

if (continueWhatsappButton) {
  continueWhatsappButton.addEventListener('click', () => {
    if (pendingWhatsappUrl) {
      window.open(pendingWhatsappUrl, '_blank', 'noopener');
    }
  });
}

if (downloadQrButton) {
  downloadQrButton.addEventListener('click', downloadReservationQr);
}

const syncMesaNotice = () => {
  if (!mesaField || !mesaNotice) {
    return;
  }

  mesaNotice.hidden = mesaField.value !== 'Si';
};

if (mesaField) {
  mesaField.addEventListener('change', syncMesaNotice);
  syncMesaNotice();
}

const restoredReservation = readPersistedReservation();

if (restoredReservation?.reservationPayload) {
  pendingWhatsappUrl = restoredReservation.pendingWhatsappUrl || '';
  paintReservationTicket(restoredReservation);
  openReservationModal();
}

bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const telefonoStudio = '5492215047962';
  const nombre = document.getElementById('nombre').value.trim();
  const instagram = document.getElementById('instagram').value.trim();
  const fecha = document.getElementById('fecha').value;
  const personas = document.getElementById('personas').value;
  const mesa = mesaField?.value || 'No';

  if (!nombre || !instagram) {
    alert('Completa tu nombre e Instagram para reservar.');
    return;
  }

  const reservaId = buildReservationCode(nombre);
  const reservationBasePayload = {
    tipo: 'reserva-pibes-de-barrio',
    reservaId,
    nombre,
    instagram,
    fecha,
    personas,
    mesa,
    emitidoEn: new Date().toISOString()
  };
  const signaturePayload = JSON.stringify(reservationBasePayload);
  const firmaReserva = buildReservationSignature(signaturePayload);
  const reservationPayload = [
    'RESERVA PIBES DE BARRIO',
    `Codigo: ${reservaId}`,
    `Nombre: ${nombre}`,
    `Instagram: ${instagram}`,
    `Fecha: ${fecha}`,
    `Asistentes: ${personas}`,
    `Mesa: ${mesa}`,
    `Firma: ${firmaReserva}`
  ].join('\n');

  const mesaDetail = mesa === 'Si'
    ? '%0A🍕 *Mesa:* Si%0A🍺 Incluye cena en mesa: pizza + birra o gaseosa $18.000%0A'
    : `🍽️ *Mesa:* ${encodeURIComponent(mesa)}%0A`;

  const mensaje = `¡Hola Pibes De Barrio! 🎙️ Quiero reservar para la transmisión.%0A%0A`
    + `📌 *Nombre:* ${encodeURIComponent(nombre)}%0A`
    + `📲 *Instagram:* ${encodeURIComponent(instagram)}%0A`
    + `📅 *Fecha:* ${encodeURIComponent(fecha)}%0A`
    + `👥 *Asistentes:* ${encodeURIComponent(personas)}%0A`
    + mesaDetail
    + `🎫 *Reserva:* ${encodeURIComponent(reservaId)}%0A`
    + `🔐 *Firma:* ${encodeURIComponent(firmaReserva)}`;

  pendingWhatsappUrl = `https://wa.me/${telefonoStudio}?text=${mensaje}`;
  const reservationData = {
    reservaId,
    nombre,
    instagram,
    fecha,
    personas,
    mesa,
    firmaReserva,
    reservationPayload,
    pendingWhatsappUrl
  };

  persistReservation(reservationData);
  paintReservationTicket(reservationData);
  openReservationModal();
  waitForQrDownloadData().then(() => {
    downloadReservationQr();
  });

  if (isIos || isAndroid || isStandalone) {
    window.location.href = pendingWhatsappUrl;
    return;
  }

  window.open(pendingWhatsappUrl, '_blank');
});