import { api } from './lib/api.js';
import { $ } from './lib/dom.js';
import { bareUrl } from './lib/format.js';
import { play } from './lib/sound.js';
import { icon } from './pixel/icons.js';
import { createMascot } from './pixel/mascot.js';
import { mountChrome } from './ui/chrome.js';
import { mountDropzone } from './ui/dropzone.js';
import { mountLibrary } from './ui/library.js';
import { mountOptions } from './ui/options.js';
import { COPIED_EVENT, copyText } from './ui/row.js';
import { mountTerminal } from './ui/terminal.js';
import { mountUploader } from './ui/uploader.js';

mountChrome();

const zone = $('#dropzone');
const mascot = createMascot($('#mascot'), { roam: () => zone.clientWidth - 140 });
document.addEventListener(COPIED_EVENT, mascot.cheer);
$('#dropzone-icon').append(icon('upload', { scale: 4 }));

const settings = await api.config();
$('#slug-prefix').textContent = `${bareUrl(settings.public_url)}/`;
mountTerminal($('#snippets'), settings.public_url);

const options = mountOptions(
  { slugInput: $('#slug'), slugStatus: $('#slug-status'), expiryGroup: $('#expiry') },
  settings,
);
const library = mountLibrary({
  section: $('#library'),
  list: $('#library-list'),
  copyAll: $('#library-copy-all'),
  more: $('#library-more'),
});

let busy = false;

const uploader = mountUploader($('#queue'), {
  onActivity(state) {
    busy = state.busy;
    if (busy) mascot.setMood('eating');
  },
  async onDone(stored) {
    mascot.setMood(stored ? 'happy' : 'sad');
    play(stored ? 'done' : 'error');
    if (!stored) return;
    await library.refresh(stored.slug);
    if (!busy) copyText(stored.url);
  },
});

mountDropzone({ zone, input: $('#file-input') }, {
  onHover: (active) => mascot.setMood(active ? 'hungry' : busy ? 'eating' : 'idle'),
  onFiles(files) {
    play('drop');
    uploader.enqueue(files, options.read());
    options.clearSlug();
  },
});
