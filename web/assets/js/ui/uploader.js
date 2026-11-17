import { api } from '../lib/api.js';
import { el } from '../lib/dom.js';
import { bytes } from '../lib/format.js';
import { fileRow, iconButton } from './row.js';

const PARALLEL = 3;
const BAR_STEPS = 20;

export function mountUploader(list, { onDone, onActivity }) {
  const waiting = [];
  let running = 0;

  function report() {
    onActivity({ busy: running > 0 || waiting.length > 0 });
  }

  function createJob(file, options) {
    const bar = el('span', { class: 'bar' }, el('span', { class: 'bar-fill' }));
    const row = fileRow({
      mime: file.type,
      title: file.name,
      meta: `${bytes(file.size)} · en cola`,
      actions: [iconButton('cross', 'Cancelar', () => job.cancel())],
    });
    row.node.append(bar);

    const job = {
      file, options, row,
      cancel: () => dismiss(),
      progress(fraction) {
        const steps = Math.round(fraction * BAR_STEPS);
        bar.style.setProperty('--progress', `${(steps / BAR_STEPS) * 100}%`);
        row.setMeta(`${bytes(file.size)} · ${Math.round(fraction * 100)}%`);
      },
    };

    function dismiss() {
      const index = waiting.indexOf(job);
      if (index >= 0) waiting.splice(index, 1);
      row.node.remove();
      report();
    }
    return job;
  }

  async function run(job) {
    running++;
    report();
    const upload = api.upload(job.file, { ...job.options, onProgress: job.progress });
    job.cancel = upload.cancel;
    try {
      const stored = await upload.done;
      job.row.node.remove();
      onDone(stored);
    } catch (error) {
      job.row.node.classList.add('is-failed');
      job.row.setMeta(error.message);
      job.cancel = () => job.row.node.remove();
      onDone(null);
    } finally {
      running--;
      pump();
      report();
    }
  }

  function pump() {
    while (running < PARALLEL && waiting.length) run(waiting.shift());
  }

  function enqueue(files, { slug, expires }) {
    files.forEach((file, index) => {
      const numbered = slug && index ? `${slug}-${index + 1}` : slug;
      const job = createJob(file, { slug: numbered, expires });
      waiting.push(job);
      list.append(job.row.node);
    });
    pump();
    report();
  }

  return { enqueue };
}
