const { bootstrap } = require('./_bootstrap.js');
(async () => {
  const { notifier } = bootstrap();
  await notifier.notify('subagent_done');
})();
