const REMOTE_DATA_BASE = 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main';

const sourceDefs = [
  {
    key: 'nvidia-game-ready',
    editorLabel: 'NVIDIA Game Ready',
    filename: 'nvidia-game-ready.json',
    url: `${REMOTE_DATA_BASE}/nvidia-game-ready.json`,
    vendor: 'nvidia',
    family: 'graphics',
    channel: 'game-ready',
    brand: 'nvidia',
    category: 'NVIDIA Game Ready',
    page: '/display'
  },
  {
    key: 'nvidia-studio',
    editorLabel: 'NVIDIA Studio',
    filename: 'nvidia-studio.json',
    url: `${REMOTE_DATA_BASE}/nvidia-studio.json`,
    vendor: 'nvidia',
    family: 'graphics',
    channel: 'studio',
    brand: 'nvidia',
    category: 'NVIDIA Studio',
    page: '/display'
  },
  {
    key: 'intel-game-on',
    editorLabel: 'Intel Game On',
    filename: 'intel-game-on.json',
    url: `${REMOTE_DATA_BASE}/intel-game-on.json`,
    vendor: 'intel',
    family: 'graphics',
    channel: 'game-on',
    brand: 'intel',
    category: 'Intel Game On',
    page: '/display'
  },
  {
    key: 'intel-pro',
    editorLabel: 'Intel Pro',
    filename: 'intel-pro.json',
    url: `${REMOTE_DATA_BASE}/intel-pro.json`,
    vendor: 'intel',
    family: 'graphics',
    channel: 'pro',
    brand: 'intel',
    category: 'Intel Pro',
    page: '/display'
  },
  {
    key: 'nvidia-game-ready-laptop',
    editorLabel: 'NVIDIA Laptop Game Ready',
    filename: 'nvidia-game-ready-laptop.json',
    url: `${REMOTE_DATA_BASE}/nvidia-game-ready-laptop.json`,
    vendor: 'nvidia',
    family: 'graphics-laptop',
    channel: 'game-ready',
    brand: 'nvidia',
    category: 'NVIDIA Laptop Game Ready',
    page: '/display/laptop'
  },
  {
    key: 'nvidia-studio-laptop',
    editorLabel: 'NVIDIA Laptop Studio',
    filename: 'nvidia-studio-laptop.json',
    url: `${REMOTE_DATA_BASE}/nvidia-studio-laptop.json`,
    vendor: 'nvidia',
    family: 'graphics-laptop',
    channel: 'studio',
    brand: 'nvidia',
    category: 'NVIDIA Laptop Studio',
    page: '/display/laptop'
  },
  {
    key: 'audio',
    editorLabel: 'Audio Drivers',
    filename: 'audio-drivers.json',
    url: `${REMOTE_DATA_BASE}/audio-drivers.json`,
    vendor: 'realtek',
    family: 'audio',
    channel: 'audio',
    brand: 'audio',
    category: 'Audio Drivers',
    page: '/audio',
    optional: true
  },
  {
    key: 'network',
    editorLabel: 'Network Drivers',
    filename: 'network-drivers.json',
    url: `${REMOTE_DATA_BASE}/network-drivers.json`,
    vendor: 'intel',
    family: 'network',
    channel: 'network',
    brand: 'network',
    category: 'Network Drivers',
    page: '/network',
    optional: true
  }
];

function getSourceByFilename(filename) {
  return sourceDefs.find((source) => source.filename === filename) || null;
}

module.exports = {
  sourceDefs,
  getSourceByFilename
};
