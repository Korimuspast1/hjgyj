// Единая точка доступа к системным функциям (избавляет от циклических импортов).
// Заполняется в phone.js при инициализации.
export const api = {
  // система
  openApp: () => {},
  closeApp: () => {},
  goHome: () => {},
  screenOn: () => {},
  screenOff: () => {},
  wake: () => {},
  lock: () => {},
  unlock: () => {},
  toggleShade: () => {},
  openShade: () => {},
  closeShade: () => {},
  reboot: () => {},
  powerOff: () => {},
  powerOn: () => {},
  showRecents: () => {},
  back: () => {},
  vibrate: () => {},
  // уведомления
  notify: () => {},
  // сеть
  hasInternet: () => ({ ok: false, why: '' }),
  signalBars: () => 0,
  setOperator: () => {},
  openTariff: () => {},
  // данные
  addPhoto: () => {},
  spend: () => true,
  earn: () => {},
  // входящие сообщения
  botSay: () => {},
  incomingCall: () => {},
  // прочее
  openNotif: () => {},
  refreshHome: () => {},
  refreshStatus: () => {},
  setTheme: () => {},
  playMusic: () => {},
  stopMusic: () => {},
  requestPin: () => Promise.resolve(false)
};
