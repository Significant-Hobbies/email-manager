// Let the existing inline session placeholder paint before the app and its CSS load.
void import('./bootstrap').catch(() => {
  const root = document.getElementById('root');
  if (!root) return;
  const main = document.createElement('main');
  main.className = 'session-loading';
  const title = document.createElement('h1');
  title.textContent = 'Kinetic';
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'Could not open the workspace.';
  const retry = document.createElement('button');
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => window.location.reload());
  main.append(title, message, retry);
  root.replaceChildren(main);
});
