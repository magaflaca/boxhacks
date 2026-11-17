export function mountDropzone({ zone, input }, { onFiles, onHover }) {
  let depth = 0;

  const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');

  function hover(active) {
    zone.classList.toggle('is-over', active);
    onHover(active);
  }

  function deliver(fileList) {
    const files = [...fileList].filter((file) => file.size > 0);
    if (files.length) onFiles(files);
  }

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    deliver(input.files);
    input.value = '';
  });

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (++depth === 1) hover(true);
  });
  window.addEventListener('dragover', (event) => hasFiles(event) && event.preventDefault());
  window.addEventListener('dragleave', (event) => {
    if (hasFiles(event) && --depth === 0) hover(false);
  });
  window.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    hover(false);
    deliver(event.dataTransfer.files);
  });
  window.addEventListener('paste', (event) => deliver(event.clipboardData?.files || []));
}
