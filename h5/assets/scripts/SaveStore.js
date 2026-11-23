/* Mirrored local saves. The first verified new copy is the durable commit point. */
(function(root,factory){
    const api=factory(root.WZData||require('./Data'),root.WZAdRewards||require('./AdRewards'));
    if(typeof module!=='undefined')module.exports=api;root.WZSaveStore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Data,AdRewards){
    'use strict';
    const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    const nonnegative=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
    const count=v=>nonnegative(v)&&Number.isSafeInteger(v);
    const optional=(s,key,check)=>s[key]===undefined||check(s[key]);
    const array=(value,max,check)=>Array.isArray(value)&&value.length<=max&&value.every(check);
    function validate(state){
        if(!record(state)||state.version!==1||!Number.isInteger(state.map)||state.map<0||state.map>2||!nonnegative(state.coins)||!array(state.rare,3,nonnegative)||state.rare.length!==3||!record(state.buys))return false;
        function safe(value,depth){
            if(depth>32)return false;if(typeof value==='number')return Number.isFinite(value);
            if(value===null||typeof value==='string'||typeof value==='boolean')return true;
            if(Array.isArray(value))return value.length<=4096&&value.every(v=>safe(v,depth+1));
            return record(value)&&Object.keys(value).length<=512&&Object.keys(value).every(key=>!['__proto__','prototype','constructor'].includes(key)&&safe(value[key],depth+1));
        }
        if(!safe(state,0))return false;
        if(state.adRewards!==undefined&&(!AdRewards.validate(state.adRewards)||state.adRewards.pending&&state.adRewards.pending.map!==state.map))return false;
        const quantities=value=>record(value)&&Object.values(value).every(v=>count(v)&&v<=10000);
        if(!quantities(state.buys)||!optional(state,'gifts',quantities))return false;
        const expected=Data.shops[state.map].filter(item=>item.type===0).reduce((sum,item)=>sum+(state.buys[item.id]||0)+(state.gifts&&state.gifts[item.id]||0)+1,0);
        if(expected>2048)return false;
        if(!optional(state,'units',v=>array(v,2048,u=>record(u)&&Number.isInteger(u.kind)&&u.kind>=0&&u.kind<12&&optional(u,'x',Number.isFinite)&&optional(u,'y',Number.isFinite))))return false;
        if(!optional(state,'pets',v=>array(v,512,p=>record(p)&&['ji','zhu'].includes(p.type)&&Number.isInteger(p.form)&&p.form>=1&&p.form<=(p.enhanced?2:3)&&optional(p,'enhanced',v=>typeof v==='boolean')&&optional(p,'x',Number.isFinite)&&optional(p,'y',Number.isFinite))))return false;
        if(!optional(state,'ores',v=>array(v,128,o=>record(o)&&Number.isInteger(o.level)&&o.level>=0&&o.level<3&&Number.isFinite(o.x)&&Number.isFinite(o.y)&&optional(o,'progress',nonnegative)&&optional(o,'fall',nonnegative))))return false;
        if(!optional(state,'transports',v=>array(v,2048,t=>record(t)&&nonnegative(t.value)&&Number.isFinite(t.time)&&t.time>0&&Number.isFinite(t.x)&&Number.isFinite(t.y))))return false;
        if(!optional(state,'boxes',v=>array(v,4,count)&&v.length===4)||!optional(state,'collects',v=>array(v,128,id=>typeof id==='string')))return false;
        if(!optional(state,'skills',v=>record(v)&&[4,5].every(k=>optional(v,k,s=>record(s)&&count(s.charge)&&nonnegative(s.time)))))return false;
        if(!optional(state,'buffs',v=>record(v)&&Object.values(v).every(nonnegative))||!optional(state,'settings',v=>record(v)&&optional(v,'sound',v=>typeof v==='boolean')))return false;
        for(const key of ['hits','activeTime','lastSeen','offlineReward','offlineSeconds'])if(!optional(state,key,nonnegative))return false;
        for(const key of ['pendingChapter','completed'])if(!optional(state,key,v=>typeof v==='boolean'))return false;
        if(!optional(state,'revisitRewards',v=>record(v)&&optional(v,'desktopAdded',v=>typeof v==='boolean')&&optional(v,'claims',c=>record(c)&&['sidebar','desktop'].every(k=>optional(c,k,d=>d===''||typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d)))))return false;
        return true;
    }
    // Integrity check, not authentication; local saves are not a cloud account or anti-cheat boundary.
    function checksum(text){let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return ('00000000'+(hash>>>0).toString(16)).slice(-8);}
    function decode(raw){
        if(raw===null||raw===undefined)return {kind:'missing',revision:-1};
        try{
            if(typeof raw!=='string'||raw.length>2000000)throw Error('size');
            const state=JSON.parse(raw);if(record(state)&&(state.version>1||record(state._save)&&state._save.format>1||record(state.adRewards)&&state.adRewards.format>1))return {kind:'unsupported',revision:-1};
            if(!record(state))throw Error('shape');const metadata=state._save;delete state._save;
            if(!validate(state))throw Error('state');
            const body=JSON.stringify(state);
            if(metadata!==undefined&&(!record(metadata)||metadata.format!==1||!Number.isSafeInteger(metadata.revision)||metadata.revision<1||metadata.checksum!==checksum(body)))throw Error('integrity');
            return {kind:'valid',state,revision:metadata?metadata.revision:0,body,raw};
        }catch(e){return {kind:'invalid',revision:-1};}
    }
    function encode(state,revision){
        const copy=Object.assign({},state);delete copy._save;if(!validate(copy))throw Error('Invalid save state');
        const body=JSON.stringify(copy);if(body.length>1900000)throw Error('Save too large');
        copy._save={format:1,revision,checksum:checksum(body)};return JSON.stringify(copy);
    }
    function create(storage,key){
        const keys=[key,key+'.backup'];let records=[],current=null,blocked=true;
        function scan(){return keys.map((name,index)=>{try{const raw=storage.getItem(name);return Object.assign({key:name,index,raw},decode(raw));}catch(e){return {key:name,index,kind:'unavailable',revision:-1};}});}
        function load(){
            records=scan();current=null;blocked=true;
            if(records.some(r=>r.kind==='unavailable'))return {ok:false,code:'unavailable'};
            if(records.some(r=>r.kind==='unsupported'))return {ok:false,code:'unsupported'};
            const valid=records.filter(r=>r.kind==='valid').sort((a,b)=>b.revision-a.revision||a.index-b.index);
            if(!valid.length){if(records.some(r=>r.kind==='invalid'))return {ok:false,code:'damaged'};blocked=false;return {ok:true,state:null,recovered:false,degraded:false};}
            current=valid[0];blocked=false;
            return {ok:true,state:JSON.parse(current.body),recovered:current.index===1,degraded:valid.length<2||valid[1].body!==current.body,revision:current.revision};
        }
        function put(index,raw){
            let written=false;try{storage.setItem(keys[index],raw);written=true;}catch(e){}
            try{const stored=storage.getItem(keys[index]);if(stored===raw)return {ok:true,verified:true};return {ok:false};}
            catch(e){return {ok:written,verified:false};}
        }
        function write(state){
            if(blocked)return {ok:false,code:'blocked'};
            let raw,revision;try{revision=(current?current.revision:0)+1;if(!Number.isSafeInteger(revision))throw Error('revision');raw=encode(state,revision);}catch(e){return {ok:false,code:'invalid'};}
            if(current&&current.revision>0&&decode(raw).body===current.body){
                const mirror=records[1-current.index];
                if(mirror&&mirror.kind==='valid'&&mirror.body===current.body)return {ok:true,degraded:false,revision:current.revision};
                const target=1-current.index,repair=put(target,current.raw);
                if(repair.ok){records[target]=Object.assign({key:keys[target],index:target},decode(current.raw));current=records[0];}
                return {ok:true,degraded:!repair.ok||!repair.verified,revision:current.revision};
            }
            // Never touch the last valid copy until another new copy is durably written.
            const first=current&&current.index===1?0:1,second=1-first,result=put(first,raw);
            if(!result.ok)return {ok:false,code:'write'};
            current=Object.assign({key:keys[first],index:first},decode(raw));records[first]=current;
            let mirror={ok:false};if(result.verified)mirror=put(second,raw);
            if(mirror.ok){records[second]=Object.assign({key:keys[second],index:second},decode(raw));current=records[0];}
            return {ok:true,degraded:!result.verified||!mirror.ok||!mirror.verified,revision};
        }
        function reset(state){
            // Only called after the player's explicit confirmation. Preserve damaged originals.
            const original=scan();if(original.some(r=>r.kind==='unavailable'||r.kind==='unsupported'))return {ok:false,code:'unavailable'};
            try{const archived=JSON.stringify({archivedAt:Date.now(),main:original[0].raw,backup:original[1].raw});storage.setItem(key+'.recovery',archived);if(storage.getItem(key+'.recovery')!==archived)throw Error('archive');}catch(e){return {ok:false,code:'archive'};}
            records=original;current=null;blocked=false;const result=write(state);if(!result.ok)blocked=true;return result;
        }
        return {load,write,reset,keys:keys.slice()};
    }
    return {create,validate,decode,encode,checksum};
});
