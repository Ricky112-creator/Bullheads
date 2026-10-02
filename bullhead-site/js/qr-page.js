var SITES={main:{host:'bullheadhotels.co.ke',name:'Bullhead'},one:{host:'branch1.bullheadhotels.co.ke',name:'Bullhead One'},two:{host:'branch2.bullheadhotels.co.ke',name:'Bullhead Two'}};
var who=document.getElementById('who'),h=location.hostname;
who.value=h.indexOf('branch1.')===0?'one':h.indexOf('branch2.')===0?'two':'main';
function make(){var o=document.getElementById('out');o.innerHTML='';var n=Math.max(1,Math.min(60,+document.getElementById('n').value||1)),S=SITES[who.value];
if(typeof QRCode==='undefined'){o.innerHTML='<p style="text-align:center;padding:24px">The QR code library could not load. Check your internet connection and press Make posters again.</p>';return}
for(var i=1;i<=n;i++){var d=document.createElement('div');d.className='p';d.innerHTML='<div><h1>'+S.name+'</h1><h2>Order from your seat</h2><small>Agiza ukiwa umekaa</small></div><div><small>TABLE \u00b7 MEZA</small><div class="tn">'+i+'</div></div><div class="q"></div><div><small>Scan \u00b7 open the menu \u00b7 tap send.<br>Skani \u00b7 fungua menyu \u00b7 tuma.</small><div class="ft">'+S.host+'</div></div>';
o.appendChild(d);new QRCode(d.querySelector('.q'),{text:'https://'+S.host+'/menu?table='+i,width:300,height:300,correctLevel:QRCode.CorrectLevel.M})}
document.getElementById('qrFor').textContent='These QR codes open '+S.host+(who.value==='main'?' (orders on the main site are not tied to one counter).':', so orders land on '+S.name+'.')}
who.onchange=make;document.getElementById('n').onchange=make;
document.getElementById('mk').onclick=make;document.getElementById('pr').onclick=function(){window.print()};make();
