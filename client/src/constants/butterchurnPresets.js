import butterchurnPresets from 'butterchurn-presets';

const ALL_BUTTERCHURN_PRESET_NAMES = Object.keys(butterchurnPresets.getPresets());

const FEATURED_BUTTERCHURN_PRESET_LABELS = {
  'Flexi, martin + geiss - dedicated to the sherwin maxawow': 'Sherwin Maxawow',
  'martin - mandelbox explorer - high speed demo version': 'Mandelbox Explorer',
  'martin - castle in the air': 'Castle in the Air',
  'martin [shadow harlequins shape code] - fata morgana': 'Fata Morgana',
  'Zylot - Paint Spill (Music Reactive Paint Mix)': 'Paint Spill',
  '$$$ Royal - Mashup (197)': 'Royal Mashup 197',
  '$$$ Royal - Mashup (220)': 'Royal Mashup 220',
  '$$$ Royal - Mashup (431)': 'Royal Mashup 431',
  'Aderrasi - Storm of the Eye (Thunder) - mash0000 - quasi pseudo meta concentrics': 'Storm of the Eye',
  'An AdamFX n Martin Infusion 2 flexi - Why The Sky Looks Diffrent Today - AdamFx n Martin Infusion - Tack Tile Disfunction B': 'Why The Sky Looks Different Today',
  'fiShbRaiN + Flexi - witchcraft 2.0': 'Witchcraft 2.0',
  '_Geiss - untitled': 'Untitled',
  '_Rovastar + Geiss - Hurricane Nightmare (Posterize Mix)': 'Hurricane Nightmare',
  'Rovastar + Loadus + Geiss - FractalDrop (Triple Mix)': 'FractalDrop',
  "TonyMilkdrop - Leonardo Da Vinci's Balloon [Flexi - merry-go-round + techstyle]": "Leonardo Da Vinci's Balloon",
};

const FEATURED_BUTTERCHURN_PRESET_NAMES = [
  'Flexi, martin + geiss - dedicated to the sherwin maxawow',
  'martin - mandelbox explorer - high speed demo version',
  'martin - castle in the air',
  'martin [shadow harlequins shape code] - fata morgana',
  'Zylot - Paint Spill (Music Reactive Paint Mix)',
  '$$$ Royal - Mashup (197)',
  '$$$ Royal - Mashup (220)',
  '$$$ Royal - Mashup (431)',
  'Aderrasi - Storm of the Eye (Thunder) - mash0000 - quasi pseudo meta concentrics',
  'An AdamFX n Martin Infusion 2 flexi - Why The Sky Looks Diffrent Today - AdamFx n Martin Infusion - Tack Tile Disfunction B',
  '_Geiss - untitled',
  'fiShbRaiN + Flexi - witchcraft 2.0',
  '_Rovastar + Geiss - Hurricane Nightmare (Posterize Mix)',
  'Rovastar + Loadus + Geiss - FractalDrop (Triple Mix)',
  "TonyMilkdrop - Leonardo Da Vinci's Balloon [Flexi - merry-go-round + techstyle]",
].filter(name => ALL_BUTTERCHURN_PRESET_NAMES.includes(name));

function formatButterchurnPresetLabel(name) {
  return FEATURED_BUTTERCHURN_PRESET_LABELS[name] ?? name.replace(/^_+/, '');
}

const orderedButterchurnPresetNames = FEATURED_BUTTERCHURN_PRESET_NAMES;

export const BUTTERCHURN_PRESET_OPTIONS = orderedButterchurnPresetNames.map(name => ({
  value: name,
  label: formatButterchurnPresetLabel(name),
}));

export const VALID_BUTTERCHURN_PRESETS = BUTTERCHURN_PRESET_OPTIONS.map(option => option.value);

export const VALID_BUTTERCHURN_PRESET_MODES = ['single', 'random'];
export const DEFAULT_BUTTERCHURN_PRESET_MODE = 'random';
export const DEFAULT_BUTTERCHURN_PRESET = BUTTERCHURN_PRESET_OPTIONS[0].value;
