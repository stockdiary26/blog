// All modules are registered before the one initial data load.
refresh().catch(error => {
  $('#app').textContent = error.message;
});
