// Preloaded into the native cashier on each page. Popup URLs use the same
// top-level navigation policy as links in the current window.
window.open = function (url) {
  if (url) window.location.assign(url);
  return null;
};

window.addEventListener('click', function (event) {
  var link = event.target.closest && event.target.closest('a[target], area[target]');
  if (link && link.getAttribute('target').toLowerCase() === '_blank') link.target = '_self';
}, true);

window.addEventListener('submit', function (event) {
  var form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  var submitter = event.submitter;
  var targetOwner = submitter && submitter.hasAttribute('formtarget') ? submitter : form;
  var targetAttribute = targetOwner === form ? 'target' : 'formtarget';
  var target = targetOwner.getAttribute(targetAttribute);
  if (target && target.toLowerCase() === '_blank') targetOwner.setAttribute(targetAttribute, '_self');
}, true);
