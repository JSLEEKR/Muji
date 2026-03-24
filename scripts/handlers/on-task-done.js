const { bootstrap } = require('./_bootstrap.js');
(async () => {
  const { notifier } = bootstrap();
  await notifier.notify('task_completed');
})();
