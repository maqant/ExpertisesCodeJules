let writeChain = Promise.resolve();
function withLock(task) {
  const run = writeChain.then(task, task);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

async function test() {
    console.log("Start");
    withLock(async () => {
        console.log("Task 1 start");
        await new Promise(r => setTimeout(r, 100));
        console.log("Task 1 done");
        return "T1";
    }).then(console.log);

    withLock(async () => {
        console.log("Task 2 start");
        await new Promise(r => setTimeout(r, 100));
        throw new Error("Task 2 failed");
    }).catch(console.error);

    withLock(async () => {
        console.log("Task 3 start");
        await new Promise(r => setTimeout(r, 100));
        console.log("Task 3 done");
        return "T3";
    }).then(console.log);
}
test();
