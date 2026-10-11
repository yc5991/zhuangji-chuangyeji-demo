const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../.local/tests/game'),{geometry,wiringIssues}=require('../.local/tests/workbench');
test('routing capacity counts individual cables, including power cables, and reports the first overflow',()=>{
 const g=new Game(),d=g.createDesign('gaming');g.assemble(d.id);g.route(d.id);const geo=geometry(d),before=geo.channels.map(c=>c.capacity),usage=new Map();
 for(const wire of d.cableRoutes)for(let i=1;i<wire.nodes.length;i++){const key=[wire.nodes[i-1],wire.nodes[i]].sort().join('-');usage.set(key,(usage.get(key)||0)+1);}
 try {
  for(const channel of geo.channels)channel.capacity=usage.get([channel.from,channel.to].sort().join('-'))||channel.capacity;
  assert.deepEqual(wiringIssues(d),[]);
  const crowded=geo.channels.find(c=>(usage.get([c.from,c.to].sort().join('-'))||0)>1);assert(crowded);crowded.capacity--;
  assert(wiringIssues(d).some(issue=>issue.includes('超过通道容量')));
 }finally{geo.channels.forEach((c,i)=>c.capacity=before[i]);}
});
