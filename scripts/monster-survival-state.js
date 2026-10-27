(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ONMSurvivalState=api;})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const fresh=id=>({id,level:1,beaten:0,status:"ready"});
  function begin(run){if(!run||!["ready","between"].includes(run.status))throw Error("Run is not ready");return{...run,status:"playing"};}
  function finish(run,id,level,won){
    if(!run||run.id!==id||run.level!==level||run.status!=="playing"||typeof won!=="boolean")throw Error("Unexpected Survival result");
    if(!won)return{...run,status:"lost"};
    return{...run,beaten:level,level:Math.min(10,level+1),status:level===10?"complete":"between"};
  }
  return{fresh,begin,finish};
});
