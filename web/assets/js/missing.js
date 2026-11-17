import { $ } from './lib/dom.js';
import { createMascot } from './pixel/mascot.js';
import { mountChrome } from './ui/chrome.js';

mountChrome();
createMascot($('#mascot'));
