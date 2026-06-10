const PRINTER_PORTS = new Set([9100, 515, 631]);
const WINDOWS_PORTS = new Set([135, 139, 445, 3389, 5985, 5986]);
const NETWORK_PORTS = new Set([22, 80, 443, 161, 5357]);
const NETWORK_VENDORS = ['cisco', 'mikrotik', 'ubiquiti'];
const MEDIA_DEVICE_VENDORS = [
  'samsung',
  'lg',
  'sony',
  'microsoft',
  'nintendo',
  'apple',
  'roku',
  'amazon',
  'google',
  'xiaomi',
  'intelbras',
  'tp-link',
  'hikvision',
  'dahua'
];
const PRINTER_VENDOR_PATTERN = /\b(HP|Hewlett[- ]Packard|Brother|Canon|Epson|Ricoh|Kyocera|Xerox|Zebra|Lexmark|Samsung Printing)\b/i;
const PRINTER_TEXT_PATTERN = /\b(printer|print server|jetdirect|laserjet|officejet|deskjet|pagewide|imageclass|pixma|workforce|ecotank|stylus|bizhub|docucentre|phaser)\b/i;

function normalizeOpenPorts(openPorts) {
  if (typeof openPorts === 'string') {
    try {
      openPorts = JSON.parse(openPorts);
    } catch {
      openPorts = openPorts.split(',');
    }
  }

  if (!Array.isArray(openPorts)) return [];

  return [...new Set(
    openPorts
      .map((port) => Number(port))
      .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535)
  )].sort((a, b) => a - b);
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (!text) return null;

  text = text
    .replace(/&#(\d+);/g, (_, code) => {
      const charCode = Number(code);
      return Number.isInteger(charCode) ? String.fromCharCode(charCode) : '';
    })
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text || /&#\d+;|&[a-z]+;/i.test(text)) return null;
  if (!/[a-z]{2,}/i.test(text)) return null;
  if (text.length > 120) return null;
  return text;
}

function isPrinterVendor(value) {
  return PRINTER_VENDOR_PATTERN.test(value || '');
}

function isPrinterText(value) {
  return isPrinterVendor(value) || PRINTER_TEXT_PATTERN.test(value || '');
}

function classifyNetworkAsset(asset = {}) {
  const openPorts = normalizeOpenPorts(asset.open_ports || asset.openPorts);
  if (asset.is_collector || asset.isCollector) {
    return {
      device_type: 'workstation',
      printer_model: null,
      open_ports: openPorts
    };
  }

  const hostname = String(asset.hostname || asset.host_name || asset.hostName || '').toLowerCase();
  const vendor = cleanText(asset.vendor);
  const detectionMethod = String(asset.detection_method || asset.detectionMethod || '').toLowerCase();
  let printerModel = cleanText(asset.printer_model || asset.printerModel);

  const hasPrinterPort = openPorts.some((port) => PRINTER_PORTS.has(port));
  const hasWindowsPort = openPorts.some((port) => WINDOWS_PORTS.has(port));
  const hasNetworkPort = openPorts.some((port) => NETWORK_PORTS.has(port));
  const hasOnlyWebPorts = openPorts.length > 0 && openPorts.every((port) => port === 80 || port === 443);
  const looksServer = /srv|server|dc-|sql|fileserver/.test(hostname);
  const snmpPrinter = detectionMethod.includes('snmp') && isPrinterText(printerModel);
  const hasMediaVendor = MEDIA_DEVICE_VENDORS.some((item) => String(vendor || '').toLowerCase().includes(item));

  let deviceType = 'unknown';

  if (hasPrinterPort || snmpPrinter || (isPrinterVendor(vendor) && hasPrinterPort)) {
    deviceType = 'printer';
  } else if (looksServer && (openPorts.includes(22) || hasWindowsPort)) {
    deviceType = 'server';
  } else if (hasWindowsPort) {
    deviceType = 'workstation';
  } else if (hasMediaVendor) {
    deviceType = 'media_device';
  } else if (
    hasOnlyWebPorts ||
    openPorts.includes(22) ||
    openPorts.includes(161) ||
    hasNetworkPort ||
    NETWORK_VENDORS.some((item) => String(vendor || '').toLowerCase().includes(item))
  ) {
    deviceType = 'network_device';
  }

  if (deviceType !== 'printer' && deviceType !== 'media_device') {
    printerModel = null;
  }

  return {
    device_type: deviceType,
    printer_model: printerModel,
    open_ports: openPorts
  };
}

module.exports = {
  classifyNetworkAsset,
  cleanText,
  normalizeOpenPorts
};
