import {TaskEngine,Command,TaskService} from '../contracts';
const service:TaskService=new TaskEngine('C:/device-local/tasks.sqlite');
const flat:Command={type:'step.add',operationId:'operation',taskId:'task',expectedRevision:1,step:{text:'Flat'}};
void service.execute(flat);
// @ts-expect-error active Steps have no ancestry
const nested:Command={type:'step.add',operationId:'operation',taskId:'task',expectedRevision:1,step:{text:'Nested',parentStepId:'parent'}};
// @ts-expect-error no recurrence command is implemented in the slice
const recurrence:Command={type:'recurrence.complete',operationId:'operation',taskId:'task',expectedRevision:1};
void nested;void recurrence;
