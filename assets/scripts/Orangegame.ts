import {_decorator,Component,Node,Canvas,Camera,UITransform,Graphics,Color,Label,EditBox,Vec3,view,ResolutionPolicy,Layers,EventTouch,game,Game as CocosGame,director,Director,sys,assetManager,Sprite,SpriteFrame,Mask} from 'cc';
import {Game} from './domain/game';
import {SaveStore} from './domain/save';
import {DATA} from './domain/data';
import {ART} from './runtime-art';
import {UI_SKIN} from './ui-art';
import {part,geometry,instances,requirements,connectors,connectionLabel,evaluate,legalSlots,nearestSlot} from './domain/workbench';
import {marketHistory} from './domain/market';
import {artLayout,containedArtLayout} from './domain/art-layout';
import {viewPoint,viewRect} from './domain/workbench-view';
import {finishing} from './domain/finishing';
import {successfulUnit,successfulCustomer} from './domain/accounting';
import type {ComputerDesign,Difficulty,ProductKind,View,Category} from './domain/types';
const {ccclass}=_decorator;
const W=720,H=1280;
// Warm stationery surrounds neutral industrial artwork; hardware keeps its own palette.
const C={bg:'#E9DDC7',panel:'#FFF7E8',panelAlt:'#F6EAD4',raised:'#F5E7CC',text:'#352C22',muted:'#73614C',line:'#CDB48D',orange:'#C75616',orangeSoft:'#F4D5AC',green:'#30694C',red:'#B93C2F',blue:'#285F80',wood:'#58402C',woodLight:'#856343',woodLine:'#A58257',onOrange:'#FFF9EC',hardware:'#182228',hardwareText:'#EDF2F3'};
const kinds:Record<ProductKind,string>={office:'平价办公',gaming:'主流游戏',quiet_office:'静音高定',premium:'创作高定'};
const cats:Record<Category,string>={cpu:'处理器',motherboard:'主板',gpu:'显卡',ram:'内存',storage:'储存',psu:'电源',cooler:'散热',case:'机箱'};
const colorNames:Record<string,string>={graphite:'石墨',silver:'银白',black:'黑色',orange:'橙色'};
const fanNames:Record<string,string>={fan0:'前侧下方',fan1:'后侧上方',fan2:'顶部前方',fan3:'前侧上方',fan4:'顶部后方'};
// User-provided reference icons are cropped sprites; labels remain live Cocos text.
const referenceIconNames:Record<string,string>={workshop:'workshop',product:'product',procurement:'procurement',orders:'orders',company:'company',calendar:'calendar',settings:'settings',assembly:'assembly',testing:'testing',monthly_report:'monthly_report',progress:'progress',reputation:'reputation',supplier:'supplier',shipping:'shipping',warning:'warning',featured:'featured',back:'back',forward:'forward'};
const money=(n:number)=>Math.round(n).toLocaleString('zh-CN');

/** Cocos owns rendering and input; the independent rules layer owns all mutations. */
@ccclass('Orangegame')
export class Orangegame extends Component {
  private ui!:Node;
  private store=new SaveStore({getItem:k=>sys.localStorage.getItem(k),setItem:(k,v)=>sys.localStorage.setItem(k,v)});
  private model:Game|null=null;
  private page='start';private selection='';private pane='配置';private fixedView:View='side';
  private category:Category='cpu';private listPage=0;private qty=1;private channel='retail';private picker=false;private addingDrive=false;
  private reportIndex=-1;private inventoryTab='parts';private pendingCustomerId='';
  private selectedInstance='';private selectedWire='';private wireSource='';private wireNodes:string[]=[];
  private speed=0;private clock=0;private repaint=0;private modal=false;private toastNode:Node|null=null;
  private companyName='橙序电脑';private difficulty:Difficulty='normal';private nameInput!:EditBox;private priceInput!:EditBox;
  private artCache=new Map<string,SpriteFrame>();private artLoading=new Set<string>();
  private uiArt=new Map<string,SpriteFrame>();private uiArtLoading=false;
  onLoad() {
    view.setDesignResolutionSize(W,H,ResolutionPolicy.SHOW_ALL);
    const root=new Node('DemoCanvas');root.layer=Layers.Enum.UI_2D;this.node.addChild(root);
    root.addComponent(UITransform).setContentSize(W,H);root.addComponent(Canvas);this.ui=root;
    const cameraNode=new Node('UICamera');root.addChild(cameraNode);
    const camera=cameraNode.addComponent(Camera);camera.projection=Camera.ProjectionType.ORTHO;camera.orthoHeight=H/2;camera.near=.1;camera.far=2000;camera.visibility=Layers.Enum.UI_2D;camera.clearFlags=Camera.ClearFlag.SOLID_COLOR;camera.clearColor=Color.fromHEX(new Color(),C.bg);cameraNode.setPosition(0,0,1000);
    root.getComponent(Canvas)!.cameraComponent=camera;
    try {const saved=this.store.load();this.model=saved.game;if(saved.message) this.scheduleOnce(()=>this.toast(saved.message),.2);} catch(e) {this.scheduleOnce(()=>this.toast((e as Error).message),.2);}
    // First launch opens the playable January workshop.
    // Returning to the title screen still exposes the normal name and difficulty flow.
    if(!this.model){this.model=new Game(undefined,this.companyName,this.difficulty);this.page='workshop';}
    else this.page=this.model.state.closed?'ending':'workshop';
    game.on(CocosGame.EVENT_HIDE,this.hide,this);game.on(CocosGame.EVENT_SHOW,this.show,this);
    // Local browser diagnostics support integration tests without changing shipped gameplay.
    if(sys.isBrowser && /^(localhost|127\.0\.0\.1)$/.test((globalThis as any).location?.hostname||'')) (globalThis as any).__orangegame=this;
    this.loadUiArt();
    this.render();
  }
  onDestroy() {game.off(CocosGame.EVENT_HIDE,this.hide,this);game.off(CocosGame.EVENT_SHOW,this.show,this);}
  private hide() {if(this.model) this.store.save(this.model);}
  private show() {if(this.model) {this.model.resume(Date.now());this.persist();this.render();}}
  update(dt:number) {
    if(!this.model||this.page==='start'||this.modal||!this.speed||this.model.state.closed) return;
    this.clock+=dt*this.speed/30;this.repaint+=dt;
    if(this.clock>=.25) {this.model.advance(this.clock);this.clock=0;}
    if(this.repaint>=2) {this.repaint=0;this.persist();if(['workshop','company'].includes(this.page)) this.render();}
  }
  private persist() {if(this.model) this.store.save(this.model);}
  private action(fn:()=>void,refresh=true) {try {fn();this.persist();if(refresh) this.render();} catch(e) {this.toast((e as Error).message);}}
  private goto(page:string) {this.page=page;this.listPage=0;this.picker=false;this.render();}
  private makeNode(parent:Node,name:string,x:number,y:number,w:number,h:number) {
    const n=new Node(name);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.addComponent(UITransform).setContentSize(w,h);n.setPosition(x-W/2,H/2-y);return n;
  }
  private box(parent:Node,name:string,x:number,y:number,w:number,h:number,color=C.panel,border?:string) {
    const n=this.makeNode(parent,name,x,y,w,h),g=n.addComponent(Graphics),radius=Math.min(14,h/3);
    const skin=color===C.panel?'card_plain':color===C.panelAlt||color===C.raised?'card_leaf':color===C.wood?'wood_sign':'';
    if(skin&&this.uiSprite(n,'full-v03/surfaces/'+skin,w,h,0,0,true))return n;
    g.fillColor=Color.fromHEX(new Color(),color);g.roundRect(-w/2,-h/2,w,h,radius);g.fill();
    if(border){g.strokeColor=Color.fromHEX(new Color(),border);g.lineWidth=2;g.stroke();}
    return n;
  }
  private heading(name:string,title:string,icon='product',y=232) {
    const n=this.makeNode(this.ui,name+'Ribbon',360,y,660,64);
    this.uiSprite(n,'full-v03/surfaces/title_ribbon',660,64,0,0,true);
    this.uiIcon(n,icon,-276,0,44);this.text(this.ui,name,title,390,y,556,44,29,C.text);
  }
  private note(name:string,title:string,y:number,h=80,icon='warning') {
    const n=this.box(this.ui,name,360,y,660,h,C.panelAlt);this.uiIcon(n,icon,-279,0,44);
    this.text(this.ui,name+'Text',title,390,y,554,h-18,22,C.muted);return n;
  }
  private metric(name:string,title:string,value:string,x:number,y:number,w=210,h=102,ink=C.orange) {
    this.box(this.ui,name,x,y,w,h);this.text(this.ui,name+'Label',title,x,y-h*.26,w-24,30,21,C.muted,Label.HorizontalAlign.CENTER);
    this.text(this.ui,name+'Value',value,x,y+h*.16,w-24,44,32,ink,Label.HorizontalAlign.CENTER);
  }
  private avatar(seed:string,x:number,y:number,size=108) {
    let sum=0;for(const char of seed)sum+=char.charCodeAt(0);
    const n=this.makeNode(this.ui,'Portrait'+seed,x,y,size,size);this.uiSprite(n,'full-v03/portraits/client_'+sum%6,size,size);
  }
  private empty(name:string,title:string,detail:string,icon='product',y=650) {
    const n=this.box(this.ui,name,360,y,660,292,C.panelAlt);this.uiIcon(n,icon,0,70,94);
    this.text(this.ui,name+'Title',title,360,y+20,600,50,29,C.text,Label.HorizontalAlign.CENTER);
    this.text(this.ui,name+'Detail',detail,360,y+88,588,74,24,C.muted,Label.HorizontalAlign.CENTER);
  }

  private badge(parent:Node,name:string,title:string,x:number,y:number,w:number,color=C.panelAlt,textColor=C.muted) {
    const n=this.makeNode(parent,name,x,y,w,44),skin=textColor===C.green?'badge_green':textColor===C.blue?'badge_blue':'button_secondary';
    this.uiSprite(n,'full-v03/surfaces/'+skin,w,44,0,0,true);
    const label=new Node('BadgeLabel');label.layer=Layers.Enum.UI_2D;n.addChild(label);label.addComponent(UITransform).setContentSize(w-18,38);
    const l=label.addComponent(Label);l.string=title;l.fontSize=20;l.lineHeight=26;l.color=Color.fromHEX(new Color(),textColor===C.green||textColor===C.blue?C.onOrange:textColor);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;
    return n;
  }

  private progress(parent:Node,name:string,x:number,y:number,w:number,value:number,color=C.orange) {
    const ratio=Math.max(0,Math.min(1,value)),track=this.makeNode(parent,name,x,y,w,20);
    this.uiSprite(track,'full-v03/surfaces/progress_track',w,20,0,0,true);
    if(!ratio)return track;
    const fillWidth=(w-18)*ratio,fill=new Node('Fill');fill.layer=Layers.Enum.UI_2D;track.addChild(fill);fill.addComponent(UITransform).setContentSize(fillWidth,10);fill.setPosition(-w/2+9+fillWidth/2,0);
    const g=fill.addComponent(Graphics);g.fillColor=Color.fromHEX(new Color(),color);g.roundRect(-fillWidth/2,-5,fillWidth,10,5);g.fill();return track;
  }

  private iconFor(title:string):string {
    if(/工坊|主页/.test(title)) return 'home';
    if(title==='产品')return 'computer';
    if(/设计|复制|新建/.test(title)) return 'design';
    if(title==='采购')return 'cart';
    if(/采购|选用|库存|到货/.test(title)) return 'box';
    if(/订单|委托/.test(title)) return 'clipboard';
    if(/公司|招聘|投资/.test(title)) return 'building';
    if(/推进|继续|开始|确认|建立/.test(title)) return 'play';
    if(/返回|回到|上|下/.test(title)) return 'arrow';
    if(/保存/.test(title)) return 'save';
    if(/月结|报告|报表/.test(title)) return 'calendar';
    if(/查看|设计/.test(title)) return 'eye';
    if(/更换|追加|增加/.test(title)) return 'plus';
    return '';
  }
  private buttonIcon(parent:Node,title:string,w:number,h:number,primary:boolean,inkColor?:string) {
    const kind=this.iconFor(title);if(!kind||w<150)return;
    const holder=new Node('Icon');holder.layer=Layers.Enum.UI_2D;parent.addChild(holder);holder.addComponent(UITransform).setContentSize(26,26);holder.setPosition(-w/2+23,0);
    const g=holder.addComponent(Graphics);g.strokeColor=Color.fromHEX(new Color(),inkColor||(primary?C.onOrange:C.muted));g.fillColor=Color.fromHEX(new Color(),inkColor||(primary?C.onOrange:C.muted));g.lineWidth=2;
    if(kind==='home'){g.moveTo(-8,0);g.lineTo(0,-7);g.lineTo(8,0);g.lineTo(6,0);g.lineTo(6,8);g.lineTo(-6,8);g.lineTo(-6,0);g.stroke();}
    else if(kind==='design'){g.moveTo(-7,7);g.lineTo(5,-5);g.lineTo(8,-2);g.lineTo(-4,9);g.close();g.stroke();g.moveTo(-8,9);g.lineTo(-4,9);g.stroke();}
    else if(kind==='computer'){g.roundRect(-7,-10,14,20,2);g.circle(0,-5,1);g.circle(0,3,4);g.stroke();}
    else if(kind==='cart'){g.moveTo(-11,8);g.lineTo(-7,8);g.lineTo(-4,-4);g.lineTo(7,-4);g.lineTo(10,5);g.lineTo(-6,5);g.stroke();g.circle(-3,-9,2);g.circle(6,-9,2);g.stroke();}
    else if(kind==='box'){g.rect(-8,-6,16,12);g.moveTo(-8,-2);g.lineTo(0,2);g.lineTo(8,-2);g.stroke();}
    else if(kind==='clipboard'){g.rect(-7,-7,14,16);g.rect(-3,-10,6,5);g.stroke();}
    else if(kind==='building'){g.rect(-8,-8,16,16);g.rect(-4,-4,3,3);g.rect(2,-4,3,3);g.rect(-4,2,3,3);g.stroke();}
    else if(kind==='play'){g.moveTo(-3,-8);g.lineTo(7,0);g.lineTo(-3,8);g.close();g.fill();}
    else if(kind==='arrow'){const sign=/下/.test(title)?-1:1;g.moveTo(-8*sign,0);g.lineTo(7*sign,0);g.moveTo(-sign,-6);g.lineTo(-8*sign,0);g.lineTo(-sign,6);g.stroke();}
    else if(kind==='save'){g.rect(-8,-8,16,16);g.rect(-4,-8,8,6);g.rect(-4,2,8,5);g.stroke();}
    else if(kind==='calendar'){g.rect(-8,-6,16,13);g.moveTo(-8,-2);g.lineTo(8,-2);g.moveTo(-4,-10);g.lineTo(-4,-4);g.moveTo(4,-10);g.lineTo(4,-4);g.stroke();}
    else if(kind==='eye'){g.ellipse(0,0,8,5);g.circle(0,0,2);g.stroke();}
    else {g.moveTo(-7,0);g.lineTo(7,0);g.moveTo(0,-7);g.lineTo(0,7);g.stroke();}
  }
  private text(parent:Node,name:string,value:string,x:number,y:number,w:number,h=36,size=24,color=C.text,align=Label.HorizontalAlign.LEFT) {
    const n=this.makeNode(parent,name,x,y,w,h),l=n.addComponent(Label);l.string=value;l.fontSize=size;l.lineHeight=size+8;l.isBold=/Heading|Title|Company$|Logo|PartName|CustomerName|ResourceValue|CompanyMetricValue/.test(name);l.color=Color.fromHEX(new Color(),color);l.horizontalAlign=align;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;l.enableWrapText=true;return n;
  }
  private button(parent:Node,name:string,title:string,x:number,y:number,w:number,fn:()=>void,primary=false,h=64,enabled=true) {
    const n=this.makeNode(parent,name,x,y,w,h),tab=/^(Pane|View|Category|Inventory|Difficulty|Instance)/.test(name);
    const normal=!enabled?'button_disabled':tab?(primary?'tab_selected':'tab_normal'):primary?'button_normal':'button_secondary';
    const skin=this.uiSprite(n,'full-v03/surfaces/'+normal,w,h,0,0,true);
    if(!skin){const g=n.addComponent(Graphics);g.fillColor=Color.fromHEX(new Color(),enabled&&primary?C.orange:C.raised);g.roundRect(-w/2,-h/2,w,h,12);g.fill();}
    const label=new Node('Caption');label.layer=Layers.Enum.UI_2D;n.addChild(label);label.addComponent(UITransform).setContentSize(w-(this.iconFor(title)&&w>=150&&!tab?58:24),h-12);label.setPosition(this.iconFor(title)&&w>=150&&!tab?13:0,0);
    const l=label.addComponent(Label);l.string=title;l.fontSize=w<150?23:25;l.lineHeight=30;l.isBold=primary;l.color=Color.fromHEX(new Color(),!enabled?C.muted:primary?(tab?C.orange:C.onOrange):C.text);l.horizontalAlign=Label.HorizontalAlign.CENTER;l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.SHRINK;
    if(!tab)this.buttonIcon(n,title,w,h,primary&&enabled);
    if(!enabled)return n;
    const restore=()=>{n.setScale(1,1,1);if(skin){skin.spriteFrame=this.uiArt.get('full-v03/surfaces/'+normal)!;this.sizeSkin(skin,w,h);skin.color=Color.WHITE;}};
    n.on(Node.EventType.TOUCH_START,()=>{n.setScale(.98,.98,1);if(skin&&primary&&!tab){skin.spriteFrame=this.uiArt.get('full-v03/surfaces/button_pressed')!;this.sizeSkin(skin,w,h);}else if(skin)skin.color=new Color(235,225,211);},this);
    n.on(Node.EventType.TOUCH_CANCEL,restore,this);n.on(Node.EventType.TOUCH_END,()=>{restore();fn();},this);return n;
  }

  private loadUiArt() {
    if(this.uiArtLoading||this.uiArt.size)return;this.uiArtLoading=true;
    const keys=[...Object.values(referenceIconNames),'cash','labor'].map(k=>'icons/'+k).concat(['surfaces/paper_tile','surfaces/wood_tile','surfaces/button_primary','surfaces/paper_panel','workshop/isometric']).concat(Object.keys(UI_SKIN));
    const load=(bundle:any)=>{let pending=keys.length;keys.forEach(key=>bundle.load((UI_SKIN[key]?.path||(key==='workshop/isometric'?key:'ui/'+key))+'/spriteFrame',SpriteFrame,(error:Error|null,frame:SpriteFrame)=>{
      if(!error&&frame)this.uiArt.set(key,frame);else console.warn('UI artwork unavailable',key);
      if(--pending===0){this.uiArtLoading=false;if(this.isValid&&!this.modal)this.render();}
    }));};
    const bundle=assetManager.getBundle('workbench');if(bundle)load(bundle);else assetManager.loadBundle('workbench',(error,loaded)=>{if(!error&&loaded)load(loaded);else this.uiArtLoading=false;});
  }
  private uiSprite(parent:Node,key:string,w:number,h:number,x=0,y=0,sliced=false,tint='#FFFFFF') {
    const frame=this.uiArt.get(key);if(!frame)return null;
    const n=new Node('Skin_'+key);n.layer=Layers.Enum.UI_2D;parent.addChild(n);n.addComponent(UITransform).setContentSize(w,h);n.setPosition(x,y);
    const sprite=n.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=frame;sprite.trim=false;sprite.color=Color.fromHEX(new Color(),tint);
    if(sliced){const border=UI_SKIN[key]?.border||[20,20,20,20];frame.insetLeft=border[0];frame.insetTop=border[1];frame.insetRight=border[2];frame.insetBottom=border[3];sprite.type=Sprite.Type.SLICED;}
    if(key==='surfaces/wood_tile'||key==='surfaces/paper_tile')sprite.type=Sprite.Type.TILED;
    this.sizeSkin(sprite,w,h);return sprite;
  }
  private sizeSkin(sprite:Sprite,w:number,h:number) {
    // Render sliced surfaces at their source height before scaling. This preserves
    // the round corners, rivets and stitching when a large source becomes a small control.
    const scale=sprite.type===Sprite.Type.SLICED?Math.min(1,h/sprite.spriteFrame!.originalSize.height):1;
    sprite.node.setScale(scale,scale,1);sprite.node.getComponent(UITransform)!.setContentSize(w/scale,h/scale);
  }
  private roomArt(parent:Node,w:number,h:number,x=0,y=0) {
    const frame=this.uiArt.get('workshop/isometric');if(!frame)return null;
    const crop=new Node('WorkshopImageCrop');crop.layer=Layers.Enum.UI_2D;parent.addChild(crop);crop.addComponent(UITransform).setContentSize(w,h);crop.setPosition(x,y);crop.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
    const scale=Math.max(w/frame.originalSize.width,h/frame.originalSize.height);
    return this.uiSprite(crop,'workshop/isometric',frame.originalSize.width*scale,frame.originalSize.height*scale);
  }

  private uiIcon(parent:Node,key:string,x:number,y:number,size:number) {return this.uiSprite(parent,'icons/'+key,size,size,x,y);}
  private sceneHit(name:string,x:number,y:number,w:number,h:number,fn:()=>void) {const n=this.makeNode(this.ui,name,x,y,w,h);n.on(Node.EventType.TOUCH_END,fn,this);return n;}
  private input(parent:Node,name:string,value:string,x:number,y:number,w:number,numeric=false) {
    const n=this.makeNode(parent,name,x,y,w,68);this.uiSprite(n,'full-v03/surfaces/input_field',w,68,0,0,true);const edit=n.addComponent(EditBox);
    const label=new Node('InputText');label.layer=Layers.Enum.UI_2D;n.addChild(label);label.addComponent(UITransform).setContentSize(w-38,56);const l=label.addComponent(Label);l.fontSize=25;l.color=Color.fromHEX(new Color(),C.text);l.verticalAlign=Label.VerticalAlign.CENTER;l.overflow=Label.Overflow.CLAMP;
    edit.textLabel=l;edit.string=value;edit.maxLength=numeric?7:28;edit.inputMode=numeric?EditBox.InputMode.NUMERIC:EditBox.InputMode.SINGLE_LINE;edit.returnType=EditBox.KeyboardReturnType.DONE;
    // Our centered UI camera uses a fixed design size. Align the browser editor
    // to the rendered field after Creator has positioned its DOM input.
    if(sys.isBrowser) n.on('editing-did-began',()=>director.once(Director.EVENT_AFTER_DRAW,()=>{
      const editor=document.activeElement as HTMLInputElement|HTMLTextAreaElement|null;
      const container=game.container,canvas=game.canvas;
      if(!editor||!container||!canvas||!container.contains(editor)||!editor.matches('input,textarea')) return;
      const rect=canvas.getBoundingClientRect(),parentRect=container.getBoundingClientRect(),scale=Math.min(rect.width/W,rect.height/H),pos=n.worldPosition;
      Object.assign(editor.style,{transform:'none',transformOrigin:'0 0',left:`${rect.left-parentRect.left+rect.width/2+(pos.x-w/2)*scale}px`,top:`${rect.top-parentRect.top+rect.height/2-(pos.y+34)*scale}px`,bottom:'auto',width:`${w*scale}px`,height:`${68*scale}px`,fontSize:`${25*scale}px`,overflow:'hidden'});
      window.scrollTo(0,0);
    }),this);
    return edit;
  }

  private toast(message:string) {this.scheduleOnce(()=>this.displayToast(message),0);}
  private displayToast(message:string) {
    this.toastNode?.destroy();this.toastNode=this.box(this.ui,'Toast',360,1058,660,128,C.panelAlt);this.uiIcon(this.toastNode,'warning',-278,0,48);this.text(this.toastNode,'Message',message,389,640,546,106,24);
    const current=this.toastNode;this.scheduleOnce(()=>{if(current?.isValid)current.destroy();if(this.toastNode===current)this.toastNode=null;},4);
  }

  private dialog(title:string,message:string,actions:{title:string;run:()=>void}[]) {
    this.modal=true;const overlay=this.makeNode(this.ui,'Dialog',360,640,720,1280),scrim=overlay.addComponent(Graphics);scrim.fillColor=new Color(24,20,16,210);scrim.rect(-360,-640,720,1280);scrim.fill();
    overlay.on(Node.EventType.TOUCH_END,(e:EventTouch)=>e.propagationStopped=true);
    const bodyH=300,height=156+bodyH+actions.length*88,top=(1280-height)/2;
    const paper=this.makeNode(overlay,'DialogPaper',360,640,680,height);this.uiSprite(paper,'full-v03/surfaces/dialog_paper',680,height,0,0,true);
    this.uiIcon(paper,/结算/.test(title)?'monthly_report':/公告/.test(title)?'supplier':'settings',-271,height/2-78,52);
    this.text(overlay,'DialogTitle',title,393,top+82,510,52,32);
    this.text(overlay,'DialogBody',message,360,top+146+bodyH/2,596,bodyH,25);
    actions.forEach((a,i)=>this.button(overlay,'DialogAction'+i,a.title,360,top+158+bodyH+i*88+34,596,()=>{this.modal=false;overlay.destroy();this.action(a.run,false);if(!this.modal)this.render();},i===0,76));
  }

  private render() {
    this.toastNode=null;this.ui.children.filter(n=>n.name!=='UICamera').forEach(n=>{n.removeFromParent();n.destroy();});
    const background=this.box(this.ui,'Background',360,640,720,1280,C.bg);this.uiSprite(background,'surfaces/paper_tile',720,1280);
    if(this.page==='start') {this.startScreen();return;}
    if(!this.model) {this.page='start';this.startScreen();return;}
    
    const s=this.model.state;
    this.box(this.ui,'HeaderBar',360,54,720,108,C.wood,C.woodLine);
    this.uiIcon(this.ui,'workshop',-303,590,48);
    this.text(this.ui,'Company',s.companyName,213,36,250,40,29,C.onOrange);
    this.text(this.ui,'Calendar',s.closed?'本次经营已结束':`${Math.round(s.elapsed)} / ${this.model.monthHours} 工时`,193,86,324,32,22,C.onOrange);
    this.badge(this.ui,'MonthChip',`2016 年 ${s.month} 月`,434,39,178,C.panel,C.text);
    this.text(this.ui,'Cash',`¥ ${money(s.cash)}`,626,39,162,38,29,'#FFBC79',Label.HorizontalAlign.RIGHT);
    this.text(this.ui,'Payables',`待付 ¥${money(this.model.outstandingCredit)}`,563,86,285,32,21,C.onOrange,Label.HorizontalAlign.RIGHT);
    this.button(this.ui,'Home','工坊',64,155,88,()=>this.goto('workshop'),false,80);
    this.button(this.ui,'News',s.pendingNews.length?`公告 ${s.pendingNews.length}`:'市场动态',212,155,184,()=>this.news(),false,80);
    this.button(this.ui,'NextWork',s.closed?'经营总结':'推进工作',430,155,220,()=>{if(s.closed){this.goto('ending');return;}this.action(()=>{const h=this.model!.nextWork();this.toast(h?`推进 ${h.toFixed(1)} 工时`:'公告已读，可以安排工作');});},true,80);
    this.button(this.ui,'Speed',s.closed?'已结束':this.speed?`${this.speed} 倍`:'暂停',624,155,152,()=>{if(s.closed)return;this.speed=this.speed===0?1:this.speed===1?4:this.speed===4?16:0;this.render();},false,80);
    ({workshop:()=>this.workshop(),designs:()=>this.designList(),workbench:()=>this.workbench(),market:()=>this.market(),orders:()=>this.orders(),company:()=>this.company(),reports:()=>this.reports(),inventory:()=>this.inventory(),feedback:()=>this.feedback(),templates:()=>this.templates(),ending:()=>this.ending(),reportNotes:()=>this.reportNotes()} as Record<string,()=>void>)[this.page]?.();
    this.navigation();
  }
  private navigation() {
    this.box(this.ui,'BottomNav',360,1234,720,92,C.wood,C.woodLine);
    const active=['workbench','feedback','templates'].includes(this.page)?'designs':this.page==='inventory'?'market':['reports','reportNotes','ending'].includes(this.page)?'company':this.page;
    const icons=['workshop','product','procurement','orders','company'];
    ['工坊','产品','采购','订单','公司'].forEach((name,i)=>{
      const dest=['workshop','designs','market','orders','company'][i],selected=active===dest;
      const n=this.makeNode(this.ui,'Nav'+dest,76+i*142,1234,128,84);
      if(selected){this.uiSprite(n,'full-v03/surfaces/nav_selected',128,88,0,0,true);}
      const icon=this.uiIcon(n,icons[i],0,12,58);
      if(!icon){this.buttonIcon(n,name,220,84,false,selected?C.orange:C.onOrange);n.getChildByName('Icon')?.setPosition(0,12);}
      const label=new Node('Caption');label.layer=Layers.Enum.UI_2D;n.addChild(label);label.addComponent(UITransform).setContentSize(120,28);label.setPosition(0,-26);
      const l=label.addComponent(Label);l.string=name;l.fontSize=21;l.lineHeight=26;l.horizontalAlign=Label.HorizontalAlign.CENTER;l.color=Color.fromHEX(new Color(),selected?C.orange:C.onOrange);l.isBold=selected;
      n.on(Node.EventType.TOUCH_START,()=>n.setScale(.97,.97,1),this);n.on(Node.EventType.TOUCH_CANCEL,()=>n.setScale(1,1,1),this);n.on(Node.EventType.TOUCH_END,()=>this.goto(dest),this);
    });
  }
  private startScreen() {
    const plaque=this.box(this.ui,'BrandPlaque',360,88,660,112,C.wood);this.uiIcon(plaque,'workshop',-248,0,68);
    this.text(this.ui,'Logo','装机创业记',399,87,490,64,40,C.onOrange,Label.HorizontalAlign.CENTER);
    const hero=this.box(this.ui,'StartWorkshop',360,302,660,290,C.hardware);this.roomArt(hero,660,290);
    this.text(this.ui,'Tagline','从一张工作台，做出自己的电脑品牌',360,495,650,52,28,C.text,Label.HorizontalAlign.CENTER);
    this.badge(this.ui,'Scope','2016 年 1—6 月',360,547,274,C.panel,C.orange);
    this.text(this.ui,'NameLabel','公司名称',360,597,604,32,23,C.muted);
    const company=this.input(this.ui,'CompanyName',this.companyName,360,649,610);
    ['easy','normal','hard'].forEach((diff,i)=>this.button(this.ui,`Difficulty${diff}`,['简单','一般','困难'][i],148+i*212,737,194,()=>{this.companyName=company.string;this.difficulty=diff as Difficulty;this.render();},diff===this.difficulty,72));
    const opening=DATA.economy.opening[this.difficulty];
    this.note('Opening',`起步资金 ¥${money(opening.cash)} · 员工 ${opening.employees} 人 · 工位 ${opening.benches} 个\n供应商授信 ¥${money(opening.creditLimitCoins)}${this.difficulty==='hard'?' · 高定委托起步':''}`,846,120,'cash');
    this.button(this.ui,'NewGame','建立公司',360,961,610,()=>{
      const begin=()=>{this.model=new Game(undefined,company.string,this.difficulty);this.page='workshop';};
      if(this.model)this.dialog('建立新公司','新公司会替换当前本地进度。当前记录会保留为上一份备份。',[{title:'建立新公司',run:begin},{title:'返回',run:()=>{}}]);else this.action(begin);
    },true,80);
    if(this.model)this.button(this.ui,'Continue','继续经营',360,1057,610,()=>this.goto(this.model!.state.closed?'ending':'workshop'),false,80);
    this.text(this.ui,'StartHint','你决定何时结算月份\n离线只完成已安排的工作，完整设计随进度保存',360,1170,610,82,23,C.muted,Label.HorizontalAlign.CENTER);
  }

  private selected():ComputerDesign {if(!this.model!.state.designs.some(d=>d.id===this.selection))this.selection=this.model!.state.designs[0]?.id||'';return this.model!.design(this.selection);}
  private openDesign(id:string) {this.selection=id;this.page='workbench';this.pane='配置';this.fixedView='side';this.picker=false;this.addingDrive=false;this.listPage=0;this.render();}
  private workshop() {
    const g=this.model!,s=g.state;
    this.heading('WorkshopTitle',s.month+' 月 · '+g.monthContent.zh,'workshop');
    const scene=this.box(this.ui,'WorkshopScene',360,476,660,410,C.hardware,C.line);
    const artwork=this.roomArt(scene,660,410);
    if(!artwork)this.text(this.ui,'SceneLoading','正在准备工坊…',360,476,620,42,25,C.hardwareText,Label.HorizontalAlign.CENTER);
    this.badge(this.ui,'AssemblyArea','装配区 · 点击设计',175,515,226,C.panel,C.text);
    this.badge(this.ui,'TestArea','测试区',568,608,122,C.panel,C.text);
    this.sceneHit('AssemblyWorkbench',205,425,330,310,()=>this.goto('designs'));
    this.sceneHit('TestingWorkbench',551,510,220,290,()=>{if(s.designs.length){this.openDesign(s.designs[s.designs.length-1].id);this.pane='测试';this.render();}else this.goto('designs');});
    const resources=[['装配工位',String(s.benches),'assembly'],['测试位',String(s.testStations),'testing'],['本月工时',Math.round(s.elapsed)+' / '+g.monthHours,'labor']];
    resources.forEach(([title,value,icon],i)=>{const x=138+i*222,n=this.box(this.ui,'Resource'+i,x,728,210,72,C.panel,C.line);this.uiIcon(n,icon,-70,0,50);this.text(this.ui,'ResourceLabel'+i,title,x+35,710,126,25,18,C.muted);this.text(this.ui,'ResourceValue'+i,value,x+35,740,126,34,26,C.text);});
    const hint=!s.designs.length?'从一个定位开始，设计你的第一台电脑':s.purchases.some(p=>!p.received)?'配件正在配送，推进工作后查看到货情况':!s.jobs.length?'完成装配与理线后，制作样机并测试':'点击排产查看作品，测试完成后交付或投产';
    this.note('GuideCard',s.month===1?hint:g.monthGuide,807,68,'progress');
    this.button(this.ui,'GuideProduct','自主产品',193,879,314,()=>this.goto('designs'),true,58);
    this.button(this.ui,'GuideCommission','高定委托',527,879,314,()=>this.goto('orders'),false,58);
    const jobs=s.jobs.filter(j=>j.status!=='complete');
    this.text(this.ui,'ScheduleTitle','当前排产',200,936,340,32,27);this.text(this.ui,'ScheduleCount',jobs.length+' 项',609,936,150,32,23,C.muted,Label.HorizontalAlign.RIGHT);
    if(!jobs.length){const n=this.box(this.ui,'EmptySchedule',360,1037,660,148,C.panel,C.line);this.uiIcon(n,'product',-245,0,91);this.text(this.ui,'NoSchedule',s.purchases.some(p=>!p.received)?'配件在途，工位等待备料':'工作台已准备好',400,1010,466,36,26);this.text(this.ui,'ScheduleHint','进入产品页创建机型，或接受一份委托',400,1056,466,50,21,C.muted);}
    jobs.slice(0,2).forEach((j,i)=>{const y=992+i*90;this.box(this.ui,'Job'+j.id,360,y,660,82,C.panel,C.line);this.productArt(j.design.case,97,y,96,72);this.text(this.ui,'JobTitle'+j.id,j.design.name,365,y-18,410,32,23);this.text(this.ui,'JobState'+j.id,j.stages[j.phase].name+' · 剩余 '+j.remaining.toFixed(1)+' 工时',365,y+8,410,30,19,C.muted);
      const stageHours=j.stages.reduce((sum,stage)=>sum+stage.hours,0),passed=j.stages.slice(0,j.phase).reduce((sum,stage)=>sum+stage.hours,0)+j.stages[j.phase].hours-j.remaining,ratio=stageHours>0?(j.completed+passed/stageHours)/j.quantity:0;
      this.text(this.ui,'JobPercent'+j.id,Math.round(Math.max(0,Math.min(1,ratio))*100)+'%',617,y-10,100,32,23,C.orange,Label.HorizontalAlign.CENTER);this.progress(this.ui,'JobProgress'+j.id,422,y+29,515,ratio);this.sceneHit('JobHit'+j.id,360,y,660,82,()=>this.openDesign(j.design.id));});
    this.button(this.ui,'MonthEnd','查看月结',360,1152,660,()=>this.monthEnd(),true,60);
  }
  private designList() {
    const g=this.model!,all=g.state.designs;this.heading('DesignTitle','产品与设计','product');
    (Object.keys(kinds) as ProductKind[]).forEach((kind,i)=>this.button(this.ui,`Create${kind}`,kinds[kind],112+i*165,326,155,()=>this.action(()=>this.openDesign(g.createDesign(kind).id)),i===0,76));
    if(!all.length)this.empty('EmptyDesigns','第一台电脑，从定位开始','选择上方定位，再完成配置、装配、打样与销售');
    all.slice(this.listPage*3,this.listPage*3+3).forEach((d,i)=>{
      const y=492+i*223;this.box(this.ui,`Design${d.id}`,360,y,660,207);
      this.box(this.ui,'ProductWell'+d.id,133,y,164,169,C.bg,C.line);this.productArt(d.case,133,y,150,152);
      this.text(this.ui,'ProductTitle',d.name,427,y-65,400,46,28);
      this.badge(this.ui,'ProductKind'+d.id,kinds[d.kind],307,y-16,154,C.panelAlt,C.orange);
      this.badge(this.ui,'ProductState'+d.id,d.standardized?'已定型':d.prototypeMade?'已打样':'设计中',487,y-16,180,C.panelAlt,d.standardized?C.green:d.prototypeMade?C.blue:C.muted);
      this.text(this.ui,'ProductCost',`修订 ${d.revision} · 配件 ¥${money(evaluate(d,g.date,false).partsCost)}`,405,y+32,350,34,21,C.muted);
      this.text(this.ui,'ProductPrice',`售价 ¥${money(d.price)}`,331,y+72,205,38,26,C.orange);
      this.button(this.ui,`Open${d.id}`,'继续设计',549,y+64,216,()=>this.openDesign(d.id),true,64);
    });
    this.pagination(all.length,3,1105);this.text(this.ui,'DesignHint','作品可保存、复制、改型，定型后持续生产销售',360,1170,646,34,22,C.muted,Label.HorizontalAlign.CENTER);
  }

  private productArt(id:string,x:number,y:number,w:number,h:number) {
    const item=ART.find(a=>a.partId===id&&a.view==='product'&&['reviewed','approved'].includes(a.state));if(!item)return;
    const key=`${item.bundle}:${item.path}`,frame=this.artCache.get(key);
    if(!frame){if(this.artLoading.has(key))return;this.artLoading.add(key);const page=this.page;
      assetManager.loadBundle(item.bundle,(error,bundle)=>{if(error||!bundle){this.artLoading.delete(key);return;}bundle.load(`${item.path}/spriteFrame`,SpriteFrame,(error,loaded)=>{this.artLoading.delete(key);if(error||!loaded)return;this.artCache.set(key,loaded);if(this.isValid&&!this.modal&&this.page===page)this.render();});});return;}
    const scale=Math.min(w/frame.originalSize.width,h/frame.originalSize.height),n=this.makeNode(this.ui,`ProductArt${id}`,x,y,frame.originalSize.width*scale,frame.originalSize.height*scale),sprite=n.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=frame;sprite.trim=false;n.getComponent(UITransform)!.setContentSize(frame.originalSize.width*scale,frame.originalSize.height*scale);
  }
  private pagination(length:number,size:number,y:number) {
    const pages=Math.max(1,Math.ceil(length/size));this.listPage=Math.min(this.listPage,pages-1);
    this.button(this.ui,'Previous','上一页',138,y,210,()=>{this.listPage=Math.max(0,this.listPage-1);this.render();},false,64,this.listPage>0);
    this.badge(this.ui,'PageNumber',String(this.listPage+1)+' / '+pages,360,y,156);
    this.button(this.ui,'Next','下一页',582,y,210,()=>{this.listPage=Math.min(pages-1,this.listPage+1);this.render();},false,64,this.listPage<pages-1);
  }

  private workbench() {
    const d=this.selected();
    this.text(this.ui,'DesignName',`${d.name} · 修订 ${d.revision}`,360,217,660,42,29);
    ['配置','装配','理线','外观','测试'].forEach((p,i)=>this.button(this.ui,`Pane${p}`,p,86+i*137,273,126,()=>{this.pane=p;this.picker=false;this.listPage=0;this.render();},this.pane===p||p==='装配'&&this.pane==='布局',68));
    if(this.picker){this.market(true);return;}
    if(this.pane==='配置') {this.configuration(d);return;}
    if(this.pane==='测试') {this.testing(d);return;}
    ['side','rear','exterior'].forEach((v,i)=>this.button(this.ui,`View${v}`,['侧面装配','背板理线','外观展示'][i],143+i*217,344,206,()=>{this.fixedView=v as View;this.render();},this.fixedView===v));
    this.drawCase(d);
    if(this.pane==='装配')this.assembly(d);else if(this.pane==='布局')this.layout(d);else if(this.pane==='理线')this.routing(d);else this.custom(d);
  }
  private configuration(d:ComputerDesign) {
    const rows:[Category,string][]=[['cpu',d.cpu],['motherboard',d.motherboard],['gpu',d.gpu||''],['ram',d.ram.map(r=>`${part(r.id).model} ×${r.quantity}`).join(' + ')],['storage',d.storage.map(r=>`${part(r.id).model} ×${r.quantity}`).join(' + ')],['psu',d.psu],['cooler',d.cooler],['case',d.case]];
    rows.forEach(([cat,value],i)=>{
      const y=367+i*84,n=this.box(this.ui,`Config${cat}`,360,y,660,78);
      this.text(this.ui,'Category'+cat,cats[cat],110,y,134,40,24,C.muted);
      this.text(this.ui,'Part'+cat,['ram','storage'].includes(cat)?value:value?part(value).displayName:'使用处理器核显',361,y,344,60,23);
      this.badge(this.ui,'ChooseLabel'+cat,'更换 ›',603,y,116,C.panelAlt,C.orange);
      n.on(Node.EventType.TOUCH_END,()=>{this.category=cat;this.addingDrive=false;this.picker=true;this.listPage=0;this.render();},this);
    });
    const result=evaluate(d,this.model!.date,false);
    this.note('ConfigurationHint',`配件参考成本 ¥${money(result.partsCost)}\n${result.blocked[0]||'平台、尺寸和供电条件符合'}`,1051,102,'assembly');
    this.button(this.ui,'AddDrive','追加工作盘',193,1149,314,()=>{this.category='storage';this.addingDrive=true;this.picker=true;this.listPage=0;this.render();},false,76);
    this.button(this.ui,'StartAssembly','进入装配',527,1149,314,()=>{this.pane='装配';this.fixedView='side';this.listPage=0;this.render();},true,76);
  }

  private caseScreenPoint(d:ComputerDesign,p:number[]):Vec3 {const g=geometry(d),scale=Math.min(530/g.width,352/g.height);return new Vec3(360-g.width*scale/2+p[0]*scale-W/2,H/2-(748-p[1]*scale),0);}
  private casePoint(d:ComputerDesign,p:number[]):Vec3 {return this.caseScreenPoint(d,viewPoint(p,geometry(d).width,this.fixedView));}
  private touchCasePoint(d:ComputerDesign,event:EventTouch):number[] {const p=event.getUILocation(),g=geometry(d),scale=Math.min(530/g.width,352/g.height);return viewPoint([(p.x-W/2+g.width*scale/2)/scale,(p.y-H+748)/scale],g.width,this.fixedView);}
  private artwork(d:ComputerDesign,id:string,rect:number[],parent=this.ui,name=`Art${id}`):boolean {
    const item=ART.find(a=>a.partId===id&&a.view===this.fixedView&&['reviewed','approved'].includes(a.state));if(!item)return false;
    const key=`${item.bundle}:${item.path}`,cached=this.artCache.get(key);
    if(!cached) {
      if(this.artLoading.has(key))return false;this.artLoading.add(key);
      assetManager.loadBundle(item.bundle,(error,bundle)=>{if(error||!bundle){this.artLoading.delete(key);return;}bundle.load(`${item.path}/spriteFrame`,SpriteFrame,(error,frame)=>{this.artLoading.delete(key);if(error||!frame)return;this.artCache.set(key,frame);if(this.isValid&&!this.modal&&this.page==='workbench')this.render();});});return false;
    }
    const g=geometry(d),scale=Math.min(530/g.width,352/g.height),layout=(item.fit==='contain'?containedArtLayout:artLayout)(item,[cached.originalSize.width,cached.originalSize.height],viewRect(item.rectMm||rect,g.width,this.fixedView)),p=this.caseScreenPoint(d,layout.anchor);
    const n=this.makeNode(this.ui,name,p.x+W/2,H/2-p.y,layout.width*scale,layout.height*scale);if(parent!==this.ui){n.setParent(parent);n.setPosition(p.x-parent.position.x,p.y-parent.position.y,0);}n.getComponent(UITransform)!.setAnchorPoint(item.pivot[0],item.pivot[1]);const sprite=n.addComponent(Sprite);sprite.sizeMode=Sprite.SizeMode.CUSTOM;sprite.spriteFrame=cached;sprite.trim=false;return true;
  }
  private drawCase(d:ComputerDesign) {
    const g=geometry(d),scale=Math.min(530/g.width,352/g.height),cx=360,cy=572;
    this.box(this.ui,'WorkbenchBackdrop',cx,cy,660,382,C.hardware,'#65767D');
    const frame=this.makeNode(this.ui,'CaseGeometry',360,640,W,H),draw=frame.addComponent(Graphics);
    const rect=(r:number[],fill:string,stroke=C.line)=>{const shown=viewRect(r,g.width,this.fixedView),p=this.caseScreenPoint(d,shown);draw.fillColor=Color.fromHEX(new Color(),fill);draw.strokeColor=Color.fromHEX(new Color(),stroke);draw.lineWidth=2;draw.rect(p.x,p.y,r[2]*scale,r[3]*scale);draw.fill();draw.stroke();};
    const caseArt=this.artwork(d,d.case,[0,0,g.width,g.height]);
    if(!caseArt||this.fixedView!=='exterior')rect([0,0,g.width,g.height],d.colors.body==='silver'?'#626B72':'#303940');
    if(this.fixedView==='exterior') {
      if(!caseArt){rect([5,5,g.width-10,g.height-10],d.colors.body==='silver'?'#9BA3A9':'#454C53');if(['glass','acrylic'].includes(d.caseModules.sidePanel))rect([22,88,g.width-44,g.height-112],'#27363C');}
      this.text(this.ui,'BrandPlate',d.caseModules.nameplate||this.model!.state.companyName,360,729,500,30,21,C.hardwareText,Label.HorizontalAlign.CENTER);
      this.text(this.ui,'ExteriorStyle',`${colorNames[d.colors.body]} · ${finishing(d).options.find(o=>o.group==='front_panel')!.zh} · ${finishing(d).level.zh}`,360,780,620,32,22,C.muted);return;
    }
    const layer:Record<string,number>={motherboard:0,cpu:1,ram:2,storage:3,psu:4,gpu:5,cooler:6};
    const highlights:{slot:typeof g.slots[number];center:Vec3}[]=[];
    for(const slot of g.slots.filter(s=>s.plane===this.fixedView).sort((a,b)=>layer[a.kind]-layer[b.kind])) {
      const installed=Object.entries(d.slotAssignments).find(([,s])=>s===slot.id),ins=installed?instances(d).find(i=>i.key===installed[0]):null;
      const fit=this.pane==='装配'&&this.selectedInstance&&legalSlots(d,this.selectedInstance).includes(slot.id);
      rect(slot.rect,ins?(slot.kind==='motherboard'?'#31514B':slot.kind==='ram'?'#5D7759':'#606B74'):C.hardware,fit?C.orange:'#65767D');
      const hasImage=ins?this.artwork(d,ins.part.id,slot.rect):false;
      const center=this.casePoint(d,[slot.rect[0]+slot.rect[2]/2,slot.rect[1]+slot.rect[3]/2]);
      if(!hasImage&&!caseArt&&slot.rect[2]>50)this.text(this.ui,`SlotLabel${slot.id}`,ins?ins.part.model:cats[slot.kind as Category],center.x+W/2,H/2-center.y,Math.max(44,slot.rect[2]*scale-6),34,18,C.hardwareText,Label.HorizontalAlign.CENTER);
      if(fit)highlights.push({slot,center});
    }
    // Back-side hardware uses the same saved installation and mirrored physical rectangle.
    if(this.fixedView==='rear')for(const slot of g.slots.filter(s=>s.plane==='side'&&(s.kind==='psu'||s.bay==='3.5-inch'))){
      const key=Object.entries(d.slotAssignments).find(([,value])=>value===slot.id)?.[0],ins=instances(d).find(i=>i.key===key);if(ins)this.artwork(d,ins.part.id,slot.rect);
    }
    // Keep the steel separator in front of devices in the lower bay; never move saved geometry to fit a drawing.
    const caseEntry=ART.find(a=>a.partId===d.case&&a.view===this.fixedView);
    if(caseArt)for(const [index,band] of (caseEntry?.foregroundBandsMm||[]).entries()){
      const shown=viewRect(band,g.width,this.fixedView),p=this.caseScreenPoint(d,[shown[0]+shown[2]/2,shown[1]+shown[3]/2]);
      const clip=this.makeNode(this.ui,`CaseRailMask${index}`,p.x+W/2,H/2-p.y,shown[2]*scale,shown[3]*scale);clip.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
      this.artwork(d,d.case,[0,0,g.width,g.height],clip,`CaseRailArt${index}`);
    }
    // Hit regions and selection borders stay above every installed sprite, including the cooler.
    for(const {slot,center} of highlights) {
      const hit=this.makeNode(this.ui,`SlotHit${slot.id}`,center.x+W/2,H/2-center.y,Math.max(44,slot.rect[2]*scale),Math.max(44,slot.rect[3]*scale));
      const highlight=hit.addComponent(Graphics);highlight.strokeColor=Color.fromHEX(new Color(),C.orange);highlight.lineWidth=3;highlight.rect(-slot.rect[2]*scale/2,-slot.rect[3]*scale/2,slot.rect[2]*scale,slot.rect[3]*scale);highlight.stroke();
      hit.on(Node.EventType.TOUCH_END,(event:EventTouch)=>this.action(()=>{const target=nearestSlot(d,this.selectedInstance,this.fixedView,this.touchCasePoint(d,event),44/scale);if(target)this.model!.installPart(d.id,this.selectedInstance,target);}));
    }
    for(const zone of g.fanZones.filter(z=>z.plane===this.fixedView))rect(zone.rect,d.fanPositions.includes(zone.id)?'#455F6A':C.hardware);
    if(this.pane==='布局') {
      const arrows=this.makeNode(this.ui,'FanOverlay',360,640,W,H).addComponent(Graphics);
      for(const zone of g.fanZones.filter(z=>z.plane===this.fixedView)) {
        const index=d.fanPositions.indexOf(zone.id),center=[zone.rect[0]+zone.rect[2]/2,zone.rect[1]+zone.rect[3]/2],p=this.casePoint(d,center);
        arrows.strokeColor=Color.fromHEX(new Color(),index<0?C.line:C.orange);arrows.lineWidth=2;arrows.circle(p.x,p.y,12);arrows.stroke();
        if(index<0)continue;
        const sign=d.fanDirections[zone.id]==='intake'?1:-1;
        const delta=zone.rect[2]>zone.rect[3]?[0,-sign*24]:[center[0]>g.width/2?-sign*24:sign*24,0],q=this.casePoint(d,[center[0]+delta[0],center[1]+delta[1]]),angle=Math.atan2(q.y-p.y,q.x-p.x);
        arrows.lineWidth=3;arrows.moveTo(p.x,p.y);arrows.lineTo(q.x,q.y);arrows.moveTo(q.x-8*Math.cos(angle-.5),q.y-8*Math.sin(angle-.5));arrows.lineTo(q.x,q.y);arrows.lineTo(q.x-8*Math.cos(angle+.5),q.y-8*Math.sin(angle+.5));arrows.stroke();
        this.text(this.ui,`FanLabel${zone.id}`,String(index+1),p.x+W/2,H/2-p.y,28,30,20,C.hardwareText,Label.HorizontalAlign.CENTER);
      }
    }
    if(this.pane==='理线') {
      const overlay=this.makeNode(this.ui,'CableOverlay',360,640,W,H).addComponent(Graphics);
      for(const wire of d.cableRoutes) {
        const source=connectors(d).find(s=>s.id===wire.from),request=requirements(d).find(r=>r.id===wire.to);if(!source||!request)continue;
        const points=[source.point,...wire.nodes.map(id=>g.anchors.find(a=>a.id===id)!.point),request.point].map(p=>this.casePoint(d,p));
        overlay.strokeColor=Color.fromHEX(new Color(),wire.to===this.selectedWire?C.orange:wire.role==='SATA_DATA'?'#80B4BD':'#E1BF82');overlay.lineWidth=wire.to===this.selectedWire?5:3;overlay.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>overlay.lineTo(p.x,p.y));overlay.stroke();
      }
      const endpoints=[connectors(d).find(s=>s.id===this.wireSource)?.point,requirements(d).find(r=>r.id===this.selectedWire)?.point].filter((p):p is number[]=>!!p);
      for(const endpoint of endpoints) {const p=this.casePoint(d,endpoint);overlay.fillColor=Color.fromHEX(new Color(),C.orange);overlay.circle(p.x,p.y,6);overlay.fill();overlay.strokeColor=Color.fromHEX(new Color(),C.text);overlay.lineWidth=2;overlay.circle(p.x,p.y,9);overlay.stroke();}
      for(const anchor of g.anchors) {
        const p=this.casePoint(d,anchor.point);overlay.fillColor=Color.fromHEX(new Color(),this.wireNodes.includes(anchor.id)?C.orange:C.muted);overlay.circle(p.x,p.y,7);overlay.fill();
        const hit=this.makeNode(this.ui,`Anchor${anchor.id}`,p.x+W/2,H/2-p.y,52,52);hit.on(Node.EventType.TOUCH_END,()=>{if(this.wireNodes.includes(anchor.id))this.wireNodes=this.wireNodes.slice(0,this.wireNodes.indexOf(anchor.id));else this.wireNodes.push(anchor.id);this.render();});
        this.text(this.ui,`AnchorLabel${anchor.id}`,anchor.id,p.x+W/2+25,H/2-p.y-17,51,28,20,C.hardwareText);
      }
    }
    this.text(this.ui,'GeometryHint',this.pane==='理线'?'点固定点添加路径；再次点选可退回该位置':this.pane==='布局'?'箭头表示气流方向；至少保留一个进风和出风口':'选择下方部件，拖到高亮安装位，或点击安装位',360,780,660,34,22,C.muted);
  }
  private assembly(d:ComputerDesign) {
    const all=instances(d),items=all.slice(this.listPage*3,this.listPage*3+3);
    items.forEach((ins,i)=>{
      let dragged=false;let start=new Vec3();
      const n=this.button(this.ui,`Instance${ins.key}`,`${ins.part.model}  ·  ${d.slotAssignments[ins.key]?'已装':'待装'}`,360,840+i*87,660,()=>{if(dragged)return;this.selectedInstance=ins.key;const target=geometry(d).slots.find(s=>s.id===legalSlots(d,ins.key)[0]);if(target)this.fixedView=target.plane as View;this.render();},this.selectedInstance===ins.key,76);
      n.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{this.selectedInstance=ins.key;const p=e.getUILocation();start.set(p.x,p.y,0);dragged=false;});
      n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const p=e.getUILocation();if(Math.hypot(p.x-start.x,p.y-start.y)>12)dragged=true;});
      const drop=(e:EventTouch)=>{if(!dragged)return;dragged=false;const geo=geometry(d),scale=Math.min(530/geo.width,352/geo.height),slot=nearestSlot(d,ins.key,this.fixedView,this.touchCasePoint(d,e),44/scale);this.action(()=>{if(!slot)throw new Error('请放到当前视图中合适的安装位');this.model!.installPart(d.id,ins.key,slot);});};
      n.on(Node.EventType.TOUCH_END,drop);n.on(Node.EventType.TOUCH_CANCEL,drop);
    });
    this.pagination(all.length,3,1095);
    this.button(this.ui,'AssistAssembly','辅助装配',138,1150,210,()=>this.action(()=>this.model!.assemble(d.id)),true);
    this.button(this.ui,'AssemblyActions','布局与拆装',360,1150,210,()=>{
      const selected=instances(d).find(i=>i.key===this.selectedInstance);
      this.dialog('装配操作','调整风扇与硬盘架，或卸下选中的部件。卸下主板会连同板上部件和相关线缆一起拆下；配置与库存仍保留。',[
        {title:'风扇与硬盘架',run:()=>{this.pane='布局';this.fixedView='side';this.listPage=0;}},
        ...(selected?[{title:`卸下 ${selected.part.model}`,run:()=>{const removed=this.model!.uninstallPart(d.id,selected.key);this.toast(removed.length?`已卸下 ${removed.length} 个部件，请重新安装并测试`:'这个部件尚未安装');}}]:[]),
        {title:'返回',run:()=>{}}
      ]);
    });
    this.button(this.ui,'ToRouting','进入理线',582,1150,210,()=>{this.pane='理线';this.fixedView='rear';this.listPage=0;this.render();});
  }
  private layout(d:ComputerDesign) {
    const g=this.model!,zones=geometry(d).fanZones;
    d.fanPositions.slice(this.listPage*2,this.listPage*2+2).forEach((position,row)=>{
      const index=this.listPage*2+row,direction=d.fanDirections[position];
      this.text(this.ui,`LayoutFan${index}`,`风扇 ${index+1} · ${fanNames[position]}`,360,830+row*113,660,32,23);
      this.button(this.ui,`FanPosition${index}`,`位置：${fanNames[position]}`,193,878+row*113,314,()=>this.action(()=>{
        const available=zones.filter(z=>!d.fanPositions.some((p,i)=>p===z.id&&i!==index)).map(z=>z.id),target=available[(available.indexOf(position)+1)%available.length];g.setFanPosition(d.id,index,target);
      }),false,72);
      this.button(this.ui,`FanDirection${index}`,`方向：${direction==='intake'?'进风':'出风'}`,527,878+row*113,314,()=>this.action(()=>g.setFanDirection(d.id,index,direction==='intake'?'exhaust':'intake')),direction==='intake',72);
    });
    this.pagination(d.fanPositions.length,2,1080);
    this.button(this.ui,'LayoutFanCount',`风扇：${d.fanCount} 个`,138,1150,210,()=>this.action(()=>{g.customize(d.id,{fanCount:d.fanCount===part(d.case).game.maxFans?2:d.fanCount+1});this.listPage=0;}));
    this.button(this.ui,'HddCage',!part(d.case).game.removableHddCage?'硬盘架：固定':d.caseModules.removeHddCage?'硬盘架：已拆':'硬盘架：保留',360,1150,210,()=>this.action(()=>g.customize(d.id,{caseModules:{...d.caseModules,removeHddCage:!d.caseModules.removeHddCage}})));
    this.button(this.ui,'BackToAssembly','返回装配',582,1150,210,()=>{this.pane='装配';this.listPage=0;this.render();},true);
  }
  private routing(d:ComputerDesign) {
    const req=requirements(d);if(!req.some(r=>r.id===this.selectedWire))this.selectedWire=req[0].id;
    const request=req.find(r=>r.id===this.selectedWire)!;
    const sources=connectors(d).filter(s=>s.role===request.role&&s.pins.includes(request.pins));
    const selected=connectors(d).find(s=>s.id===this.wireSource);if(!selected||selected.role!==request.role)this.wireSource=sources[0]?.id||'';
    this.button(this.ui,'WireRequirement',`${connectionLabel(request.id)} · ${request.pins} 针 · ${d.cableRoutes.some(w=>w.to===request.id)?'已接':'待接'}`,360,822,660,()=>{this.selectedWire=req[(req.indexOf(request)+1)%req.length].id;this.wireNodes=[];this.wireSource='';this.render();});
    this.button(this.ui,'WireSource',`来源：${this.wireSource?connectionLabel(this.wireSource):'无适配接口'}`,360,892,660,()=>{const i=sources.findIndex(s=>s.id===this.wireSource);this.wireSource=sources[(i+1)%sources.length]?.id||'';this.render();});
    this.text(this.ui,'WirePath',`路径：${this.wireNodes.join(' → ')||'直连'}\n${d.cableRoutes.length}/${req.length} 项连接已完成`,360,973,660,72,23,C.muted);
    this.button(this.ui,'ConnectWire','确认连接',193,1064,314,()=>this.action(()=>{this.model!.connectWire(d.id,request.id,this.wireSource,this.wireNodes);this.wireNodes=[];}),true);
    this.button(this.ui,'ClearPath','清空路径',527,1064,314,()=>{this.wireNodes=[];this.render();});
    this.button(this.ui,'AssistRouting','辅助理线',193,1148,314,()=>this.action(()=>this.model!.route(d.id)));
    this.button(this.ui,'ToTesting','采购与打样',527,1148,314,()=>{this.pane='测试';this.render();},true);
  }
  private custom(d:ComputerDesign) {
    const finish=finishing(d),option=(id:string)=>finish.options.find(o=>o.group===id)!;
    const cycle=(list:string[],value:string)=>list[(list.indexOf(value)+1)%list.length];
    const rows:[string,()=>void][]=[
      [`工艺：${finish.level.zh} · ¥${money(finish.level.additionalConsumablesCoins)} / ${finish.labor} 工时`,()=>this.model!.customize(d.id,{finishLevelId:cycle(DATA.finish.levels.map(l=>l.id),finish.level.id)})],
      [`机身配色：${colorNames[d.colors.body]} · ¥${money(option('colour').cost)}`,()=>this.model!.customize(d.id,{colors:{...d.colors,body:cycle(['graphite','silver','orange'],d.colors.body)}})],
      [`线缆配色：${colorNames[d.colors.cables]}`,()=>this.model!.customize(d.id,{colors:{...d.colors,cables:cycle(['black','silver','orange'],d.colors.cables)}})],
      [`侧板：${option('side_panel').zh} · ¥${money(option('side_panel').cost)}`,()=>this.model!.customize(d.id,{caseModules:{...d.caseModules,sidePanel:cycle(DATA.caseOptions.groups.find(g=>g.id==='side_panel')!.options.map(o=>o.id),option('side_panel').id)}})],
      [`面板：${option('front_panel').zh} · ¥${money(option('front_panel').cost)}`,()=>this.model!.customize(d.id,{caseModules:{...d.caseModules,panel:cycle(DATA.caseOptions.groups.find(g=>g.id==='front_panel')!.options.map(o=>o.id),option('front_panel').id)}})],
      [`灯效：${option('lighting').zh} · ¥${money(option('lighting').cost)}`,()=>this.model!.customize(d.id,{lighting:cycle(['off','white','argb'],d.lighting)})]
    ];
    rows.slice(this.listPage*3,this.listPage*3+3).forEach(([title,fn],i)=>this.button(this.ui,`Custom${this.listPage*3+i}`,title,360,848+i*89,660,()=>this.action(fn),false,78));
    this.pagination(rows.length,3,1104);
    this.text(this.ui,'CustomHint',`外观耗材 ¥${money(finish.cost)} · 工艺 ${finish.labor} 工时\n修改后需要重新制作或返工测试`,360,1167,650,50,21,C.muted,Label.HorizontalAlign.CENTER);
  }
  private testing(d:ComputerDesign) {
    const g=this.model!,t=d.test?.revision===d.revision?d.test:evaluate(d,g.date);
    this.text(this.ui,'TestHeading',d.prototypeMade?'当前版本测试':'打样前检查',222,340,385,40,29);
    this.button(this.ui,'MarketFeedback','客群反馈',562,340,248,()=>this.goto('feedback'),false,64);
    [['办公',t.scores.office],['游戏',t.scores.gaming],['创作',t.scores.creation]].forEach(([label,value],i)=>this.metric('TestMetric'+i,String(label),String(value),138+i*222,432,210,106));
    const dimensions=t.dimensionScores||evaluate(d,g.date).dimensionScores!;
    this.note('TestScores',`温度 ${Math.round(dimensions.thermals)} · 性能 ${Math.round(dimensions.performance)} · 成本 ${Math.round(dimensions.cost)}\n噪声负担 ${t.noise} · 稳定度 ${Math.round(t.coolingRatio*100)}% · 外观 ${Math.round(t.appearance)} · 理线 ${t.tidiness}`,541,100,'testing');
    const customer=g.state.customers.find(c=>c.designId===d.id&&c.status==='accepted'),problems=customer?g.customerIssues(d,customer):t.blocked;
    const n=this.box(this.ui,'TestValidation',360,670,660,136,problems.length?C.panelAlt:C.panel);this.uiIcon(n,problems.length?'warning':'featured',-274,0,48);
    this.text(this.ui,'TestProblems',problems.length?problems.slice(0,5).join('；'):t.warnings.length?t.warnings.join('；'):'配置、安装位和线缆检查通过，可以制作样机',390,670,550,110,24,problems.length?C.red:C.green);
    this.button(this.ui,'RunMode',`调校：${{quiet:'静音',balanced:'均衡',performance:'高风量'}[d.fanProfile]}`,191,778,318,()=>this.action(()=>{const a=['quiet','balanced','performance'];g.customize(d.id,{fanProfile:a[(a.indexOf(d.fanProfile)+1)%3]});}),false,64);
    this.button(this.ui,'FanCount',`风扇 ${d.fanCount} 个`,528,778,318,()=>this.action(()=>g.customize(d.id,{fanCount:d.fanCount===part(d.case).game.maxFans?2:d.fanCount+1})),false,64);
    this.button(this.ui,'ProcureMissing','采购缺件',191,851,318,()=>this.action(()=>{const n=g.procureMissing(d.id);this.toast(n?'采购已确认，推进工作等待到货':'所需配件已在库存、在途或现有样机中');}),true,64);
    this.button(this.ui,'MakePrototype',d.prototypeMade?'重新打样':'制作样机',528,851,318,()=>this.action(()=>g.schedule(d.id,1,'prototype',customer?.id||null)),true,64);
    this.text(this.ui,'ProductNameLabel','产品名称',245,903,426,27,20,C.muted);this.text(this.ui,'PriceLabel','售价 / 元',584,903,205,27,20,C.muted);
    this.nameInput=this.input(this.ui,'ProductName',d.name,246,949,430);this.priceInput=this.input(this.ui,'ProductPrice',String(d.price),584,949,205,true);
    this.button(this.ui,'SaveIdentity','命名定价',191,1025,318,()=>this.action(()=>g.setIdentity(d.id,this.nameInput.string,Number(this.priceInput.string))),false,60);
    this.button(this.ui,'Standardize','定型为标准产品',528,1025,318,()=>this.action(()=>g.standardize(d.id)),false,60);
    this.button(this.ui,'DeliverOrSell',customer?'交付委托':'销售库存',191,1093,318,()=>this.action(()=>{if(customer){const satisfaction=g.deliver(customer.id);this.toast(customer.deliveryOutcome==='arrival_defect'?'到货故障：已全额退款并记录物流支出，未计入成功交付':`客户满意度 ${satisfaction}`);}else {const r=g.sellStock(d.id);this.toast(`成功售出 ${r.sold} 台。${r.reason}`);}}),true,60);
    this.button(this.ui,'CloneDesign','复制改型',528,1093,318,()=>this.action(()=>this.openDesign(g.copyDesign(d.id).id)),false,60);
    this.button(this.ui,'BatchProduction',`批量生产 ${this.qty} 台`,191,1161,318,()=>this.dialog('安排定型产品生产',`按 ${this.qty} 台备料并排产。先采购全部缺件，再安排生产。`,[{title:'采购批次缺件',run:()=>{g.procureMissing(d.id,this.qty,this.channel,false);}},{title:'确认排产',run:()=>{g.schedule(d.id,this.qty,'production');}},{title:'返回',run:()=>{}}]),false,60);
    this.button(this.ui,'BatchQuantity','调整批量',528,1161,318,()=>{this.qty=this.qty===1?5:this.qty===5?20:1;this.render();},false,60);
  }

  private market(choosing=false) {
    const g=this.model!;
    if(choosing){this.text(this.ui,'MarketHeading',`选择${cats[this.category]}`,360,337,660,40,30);this.button(this.ui,'BackToConfig','返回配置',154,403,240,()=>{this.picker=false;this.addingDrive=false;this.render();},false,64);if(this.category==='gpu')this.button(this.ui,'UseIGPU','使用核显',508,403,340,()=>this.action(()=>{g.changePart(this.selection,'gpu',null);this.picker=false;}),false,64);}
    else {this.heading('MarketHeading','配件市场','procurement');this.button(this.ui,'InventoryDetails','库存与到货',540,309,286,()=>this.goto('inventory'),false,64);
      this.text(this.ui,'CatalogCount','本期 32 款配件',202,309,335,36,23,C.muted);
      (Object.keys(cats) as Category[]).forEach((cat,i)=>this.button(this.ui,`Category${cat}`,cats[cat],112+i%4*165,388+Math.floor(i/4)*72,155,()=>{this.category=cat;this.listPage=0;this.render();},cat===this.category,64));}
    const list=DATA.parts.filter(p=>p.category===this.category);
    list.slice(this.listPage*2,this.listPage*2+2).forEach((p,i)=>{
      const y=(choosing?594:620)+i*249,released=p.release<=g.date;this.box(this.ui,`Market${p.id}`,360,y,660,233);
      this.box(this.ui,'PartWell'+p.id,128,y,150,170,C.bg,C.line);this.productArt(p.id,128,y,142,155);
      this.text(this.ui,'PartName',p.displayName,441,y-71,460,68,26,released?C.text:C.muted);
      const factor=g.priceFactor(p.id),platform=({skylake_1151:'LGA 1151 平台',broadwell_e_2011_3:'LGA 2011-3 平台',broadwell_e_2011:'LGA 2011-3 平台',fx_am3plus:'AM3+ 平台'} as Record<string,string>)[p.game.platform]||String(p.game.platform||'').replace(/_/g,' ');
      const spec=p.category==='cpu'?platform:p.category==='motherboard'?[p.game.formFactor,p.game.ramType].filter(Boolean).join(' · '):p.category==='gpu'?`${p.game.vramGB||''}GB 显存`:p.game.capacityGB?`${p.game.capacityGB}GB${p.game.ramType?' · '+p.game.ramType:''}`:p.game.ratedOutputW?`${p.game.ratedOutputW}W 额定功率`:p.game.formFactor||p.game.dimensionsMm?.height&&`${p.game.dimensionsMm.height}mm 高度`||'';
      this.text(this.ui,'PartInfo',released?`¥${money(g.unitPrice(p.id,choosing?'retail':this.channel))} · 库存可用 ${g.available(p.id)}${factor!==1?` · ${factor>1?'↑':'↓'}${Math.abs(Math.round((factor-1)*100))}%`:''}`:`供货日期 ${p.release}`,434,y-7,442,44,25,released?C.orange:C.muted);
      this.text(this.ui,'PartSpec',String(spec),341,y+65,252,54,22,C.muted);
      this.button(this.ui,`Buy${p.id}`,released?(choosing?'选用':'采购'):'未供货',576,y+65,184,()=>this.action(()=>{if(choosing){if(this.addingDrive)g.addDrive(this.selection,p.id);else g.changePart(this.selection,this.category,p.id,['ram','storage'].includes(this.category)?Math.min(4,this.qty):1);this.picker=false;this.addingDrive=false;}else {g.purchase(p.id,this.qty,this.channel);this.toast('采购已确认，推进工作可收到配件');}}),released,72,released);
    });this.pagination(list.length,2,1024);
    this.button(this.ui,'PurchaseQuantity',`数量 ${this.qty}`,176,1101,280,()=>{this.qty=this.qty===1?2:this.qty===2?5:this.qty===5?20:1;this.render();},false,64);
    if(!choosing)this.button(this.ui,'PurchaseChannel',DATA.channels.find(c=>c.id===this.channel)!.zh,511,1101,350,()=>{this.channel=DATA.channels[(DATA.channels.findIndex(c=>c.id===this.channel)+1)%DATA.channels.length].id;this.render();},false,64);
    const channel=DATA.channels.find(c=>c.id===this.channel)!;
    this.text(this.ui,'ProcurementRule',choosing?'选用会替换该类别；工作盘可在配置页追加':`同款 ${channel.minimumUnitsPerLine} 件起 · ${channel.nominalDeliverySimHours} 工时到货 · ${channel.paymentTermMonths?`${channel.paymentTermMonths} 月账期`:'零购现付'}\n${channel.paymentTermMonths?`授信剩余 ¥${money(g.creditLimit-g.outstandingCredit)} · `:''}分开的订单不累计折扣`,360,1158,646,58,21,C.muted,Label.HorizontalAlign.CENTER);
  }

  private orders() {
    const g=this.model!,orders=g.state.customers.filter(c=>c.dueMonth===g.state.month);this.heading('OrdersHeading','客户委托与交付','orders');
    [['待接单','open'],['制作中','accepted'],['已交付','completed']].forEach(([title,status],i)=>this.badge(this.ui,'OrderCount'+i,`${title} ${orders.filter(c=>c.status===status&&(status!=='completed'||successfulCustomer(c))).length}`,138+i*222,325,210,C.panelAlt,status==='completed'?C.green:status==='accepted'?C.blue:C.orange));
    if(!orders.length)this.empty('EmptyOrders','本月没有委托','可以开发自主产品，下一月结算后再查看','orders');
    orders.slice(this.listPage*2,this.listPage*2+2).forEach((c,i)=>{
      const y=543+i*305;this.box(this.ui,`Customer${c.id}`,360,y,660,286);this.avatar(c.id,112,y-65,104);
      this.text(this.ui,'CustomerName',c.name,329,y-89,312,46,28);
      const status=c.deliveryOutcome==='arrival_defect'?'故障已退款':{open:'待接单',accepted:'制作中',completed:'已交付',declined:'已关闭',expired:'已逾期'}[c.status];
      this.badge(this.ui,`CustomerStatus${c.id}`,status,579,y-88,162,C.panelAlt,c.deliveryOutcome==='arrival_defect'?C.red:c.status==='completed'?C.green:c.status==='accepted'?C.blue:c.status==='expired'?C.red:C.orange);
      this.text(this.ui,'CustomerBudget',`预算 ¥${money(c.budget)} · ${colorNames[c.color]} · 本月交付`,424,y-41,498,40,24,C.orange);
      const score=Object.entries(c.minimumScores).map(([k,v])=>`${({office:'办公',gaming:'游戏',creation:'创作'} as Record<string,string>)[k]} ≥${v}`).join(' · ');
      this.text(this.ui,'CustomerNeeds',`内存 ≥${c.minRam}GB${c.minStorage?` · 储存 ≥${c.minStorage}GB`:''}${c.maxNoise!==null?` · 噪声 ≤${c.maxNoise}`:''}\n${score}${c.discreteGpu?` · 独显${c.minVram?` ≥${c.minVram}GB`:''}`:''}`,360,y+21,608,79,24,C.muted);
      this.button(this.ui,`Accept${c.id}`,c.status==='open'?'接受委托':c.status==='accepted'?'继续设计':c.status==='completed'?'查看作品':'已关闭',529,y+94,270,()=>this.action(()=>{if(c.status==='open')this.openDesign(g.acceptCustomer(c.id).id);else if(c.designId)this.openDesign(c.designId);}),c.status==='open',66,['open','accepted','completed'].includes(c.status));
      if(c.status==='open'&&g.state.designs.length)this.button(this.ui,`Reuse${c.id}`,'从已有机型开始',203,y+94,296,()=>{this.pendingCustomerId=c.id;this.goto('templates');},false,66);
      else this.text(this.ui,'OrderNote',c.deliveryOutcome==='arrival_defect'?'已退回全部货款\n故障物流及成本已记账':c.status==='accepted'?`已收预付款 ¥${money(c.deposit)}\n约定售价 ¥${money(c.agreedPrice!)}`:c.status==='completed'?`满意度 ${c.satisfaction??'待评价'}`:'收到预付款后开始制作',209,y+94,302,58,21,c.deliveryOutcome==='arrival_defect'?C.red:c.status==='accepted'?C.green:C.muted);
    });this.pagination(orders.length,2,1098);this.text(this.ui,'DepositHint','接受后收到预付款，售价锁定；设计修改后需重新测试',360,1169,650,58,22,C.muted,Label.HorizontalAlign.CENTER);
  }

  private company() {
    const g=this.model!,s=g.state;this.heading('CompanyHeading','公司与品牌','company');
    const banner=this.box(this.ui,'CompanyIdentity',360,328,660,112,C.panelAlt);this.roomArt(banner,152,94,-237,0);
    this.text(this.ui,'CompanyTitle',s.companyName,433,303,436,42,30);this.text(this.ui,'CompanyTeam',`${s.employees} 名员工 · ${s.benches} 个工位 · ${s.testStations} 个测试位`,435,348,440,38,23,C.muted);
    [['成功售出',`${s.finished.filter(successfulUnit).length} 台`],['保存作品',`${s.designs.length} 款`],['客户口碑',`${s.reputation.toFixed(1)} 分`]].forEach(([label,value],i)=>this.metric('CompanyMetric'+i,label,value,138+i*222,452,210,102));
    const finance=this.box(this.ui,'CompanyFinance',360,616,660,202,C.panelAlt);this.uiIcon(finance,'cash',-274,62,44);
    this.text(this.ui,'FinanceTitle','资金与经营记录',243,553,332,34,26);
    this.text(this.ui,'CompanyStats',`固定开支 ¥${money(g.fixedCost)} / 月\n供应商待付 ¥${money(g.outstandingCredit)}\n未售成品 ${s.finished.filter(u=>u.status==='stock').length} 台`,217,632,310,111,22,C.muted);
    if(s.reports.length){
      const reports=s.reports.slice(-6),max=Math.max(1,...reports.map(r=>Math.max(r.revenue,r.cogs+r.fixed+r.development))),chart=this.makeNode(this.ui,'FinanceChart',360,640,720,1280).addComponent(Graphics);
      reports.forEach((r,i)=>{const x=391+i*43;for(const [j,value,ink] of [[0,r.revenue,C.orange],[1,r.cogs+r.fixed+r.development,C.woodLight]] as [number,number,string][]){const h=78*value/max;chart.fillColor=Color.fromHEX(new Color(),ink);chart.rect(x+j*15-360,640-665,12,h);chart.fill();}this.text(this.ui,'ChartMonth'+i,String(r.month)+'月',x+8,685,43,24,17,C.muted,Label.HorizontalAlign.CENTER);});
      this.text(this.ui,'FinanceLegend','橙：收入  棕：费用',519,553,286,30,19,C.muted,Label.HorizontalAlign.CENTER);
    }else {this.uiIcon(finance,'monthly_report',207,18,64);this.text(this.ui,'FinanceEmpty','月结后显示实际收支',552,664,240,62,21,C.muted,Label.HorizontalAlign.CENTER);}
    const investNames:Record<string,string>={craft_tools:'精品工具',bench:'增加装配工位',semi_auto:'基础半自动设备'};
    Object.entries(DATA.economy.investments).forEach(([id,value],i)=>{
      const y=780+i*108,done=id!=='bench'&&s.investments.includes(id),need=!!value.requiresBenches&&s.benches<value.requiresBenches;
      const effect=id==='craft_tools'?`高定装配工时 −${Math.round((1-value.commissionAssemblyMultiplier!)*100)}% · 耗材 −¥${money(value.commissionConsumablesReduction||0)}`:id==='bench'?`增加 ${value.addedBenches} 个工位，可并行装配`:`量产装配工时 −${Math.round((1-value.standardAssemblyMultiplier!)*100)}% · 月水电 +¥${money(value.additionalMonthlyUtilities||0)}`;
      this.box(this.ui,`Investment${id}`,360,y,660,98);this.text(this.ui,'InvestmentName',`${investNames[id]||id} · ¥${money(value.cost)}`,285,y-22,480,38,25);this.text(this.ui,'InvestmentUse',effect,284,y+26,478,40,21,C.muted);
      this.button(this.ui,`Invest${id}`,done?'已投入':need?`需 ${value.requiresBenches} 工位`:'投资',604,y,128,()=>this.action(()=>g.invest(id)),!done&&!need,68,!done&&!need);
    });
    this.button(this.ui,'Hire',`招聘 ¥${money(DATA.economy.employee.recruitmentCost)}`,193,1074,314,()=>this.action(()=>g.hire()),false,64);
    this.button(this.ui,'Reports',s.closed?'经营总结':'经营月报',527,1074,314,()=>{this.reportIndex=-1;this.goto(s.closed?'ending':'reports');},true,64);
    this.button(this.ui,'SaveNow','保存进度',193,1150,314,()=>this.action(()=>this.toast('完整设计与经营进度已保存')),false,64);this.button(this.ui,'ReturnTitle','回到标题',527,1150,314,()=>this.goto('start'),false,64);
  }

  private news() {
    const g=this.model!,messages=g.state.pendingNews.length?g.state.pendingNews:[...marketHistory(g.state.marketRecords),...DATA.events.filter(e=>e.date<=g.date).map(e=>e.title)];
    const pages=messages.length?messages:['暂时没有新消息，配件按供货日期逐步开放'];
    const show=(index:number)=>this.dialog(`工坊公告 · ${index+1} / ${pages.length}`,pages[index],[
      ...(index<pages.length-1?[{title:'下一条公告',run:()=>show(index+1)}]:[]),
      {title:index<pages.length-1?'全部标记已读':'知道了',run:()=>g.acknowledgeNews()}
    ]);show(0);
  }
  private monthEnd() {
    const g=this.model!;if(g.state.closed){this.goto('ending');return;}
    const jobs=g.state.jobs.filter(j=>j.status!=='complete').length,orders=g.state.customers.filter(c=>c.status==='accepted'&&c.dueMonth===g.state.month).length;
    this.dialog(`${g.state.month} 月结算`,`${jobs} 项工作尚未完成，${orders} 份委托尚未交付。\n本月固定开支 ¥${money(g.fixedCost)}。到期账款会同时支付。\n库存与未完成排产保留，逾期委托退回预付款。${g.state.month===6?'本次 Demo 将结束。':'结算后进入下一个月。'}`,[{title:'确认结算',run:()=>{g.settle();this.reportIndex=-1;this.page=g.state.closed?'ending':'reports';}},{title:'继续经营',run:()=>{}}]);
  }
  private inventory() {
    const g=this.model!,s=g.state;this.heading('InventoryHeading','库存、预留与配送','procurement');
    ['parts','finished','incoming'].forEach((tab,i)=>this.button(this.ui,`Inventory${tab}`,['配件批次','未售成品','在途采购'][i],138+i*222,326,210,()=>{this.inventoryTab=tab;this.listPage=0;this.render();},this.inventoryTab===tab,72));
    const rows:{id:string;art:string;title:string;detail:string;badge:string}[]=this.inventoryTab==='parts'
      ?s.inventory.filter(l=>l.quantity>0).map(l=>({id:l.id,art:l.partId,title:part(l.partId).displayName,badge:`可用 ${l.quantity-l.reserved}`,detail:`在库 ${l.quantity} · 排产预留 ${l.reserved}\n实付单价 ¥${money(l.unitCost)}\n批次成本 ¥${money(l.quantity*l.unitCost)}`}))
      :this.inventoryTab==='finished'?s.finished.filter(u=>u.status==='stock').map(u=>({id:u.id,art:u.design.case,title:u.design.name,badge:u.customerId?'交付预留':'可售成品',detail:`${kinds[u.kind]} · 修订 ${u.design.revision}\n实际制作成本 ¥${money(u.cost)}`}))
      :s.purchases.filter(p=>!p.received).map(p=>({id:p.id,art:p.partId,title:part(p.partId).displayName,badge:`采购 ${p.quantity} 件`,detail:`还需 ${Math.max(0,p.eta-g.absoluteHours).toFixed(1)} 工时\n总价 ¥${money(p.quantity*p.unitCost)}\n${p.paid?'已付款':`${p.dueMonth} 月结算付款`}`}));
    if(!rows.length)this.empty('EmptyInventory',this.inventoryTab==='incoming'?'没有在途采购':'这里暂时没有库存',this.inventoryTab==='incoming'?'在市场采购配件后，推进工作等待到货':'配件到货和制作完成后，会分别记录在这里',this.inventoryTab==='incoming'?'shipping':'procurement');
    rows.slice(this.listPage*3,this.listPage*3+3).forEach((r,i)=>{const y=493+i*205;this.box(this.ui,`InventoryRow${r.id}`,360,y,660,191);this.productArt(r.art,117,y+5,122,146);this.text(this.ui,'InventoryName',r.title,423,y-59,477,52,25);this.text(this.ui,'InventoryState',r.detail,351,y+28,330,102,23,C.muted);this.badge(this.ui,'InventoryBadge'+r.id,r.badge,585,y+15,148,C.panelAlt,this.inventoryTab==='incoming'?C.blue:C.green);});
    this.pagination(rows.length,3,1078);this.text(this.ui,'InventoryCostRule','旧批次按原成本记录，预留配件供已有排产使用',360,1161,644,66,23,C.muted,Label.HorizontalAlign.CENTER);
  }

  private feedback() {
    const g=this.model!,d=this.selected(),a=g.demandAssessment(d.id);this.heading('FeedbackHeading',`${d.name} · 客群反馈`,'reputation');
    this.note('FeedbackDemand',`本月同类已售 ${a.alreadySold} 台 · 预计还可售 ${a.available} 台\n定价接受度包含外观偏好，销量随经营变化`,329,106,'product');
    a.rows.slice(this.listPage*3,this.listPage*3+3).forEach((r,i)=>{const y=496+i*190;this.box(this.ui,`Feedback${r.archetype}`,360,y,660,178);this.avatar(r.archetype,112,y-19,94);this.text(this.ui,'FeedbackName',r.name,318,y-53,286,42,26);this.badge(this.ui,'FeedbackState'+r.archetype,r.eligible?'符合需求':'需要调整',566,y-53,184,C.panelAlt,r.eligible?C.green:C.orange);
      this.text(this.ui,'FeedbackDetail',r.issues.length?r.issues.slice(0,3).join('；'):`参考预算 ¥${money(r.referencePrice)} · 定价接受度 ${Math.round(r.acceptance*100)}%\n配置适配 ${Math.round(r.fit*100)}% · 本月预计 ${r.expectedUnits.toFixed(1)} 台`,419,y+12,486,91,23,C.muted);this.progress(this.ui,'FeedbackFit'+r.archetype,423,y+67,478,r.fit,r.eligible?C.green:C.orange);});
    this.pagination(a.rows.length,3,1065);this.button(this.ui,'BackToTesting','返回设计与测试',360,1149,660,()=>{this.page='workbench';this.pane='测试';this.render();},true,76);
  }

  private templates() {
    const g=this.model!,customer=g.state.customers.find(c=>c.id===this.pendingCustomerId);this.heading('TemplatesHeading','选一款已有设计作为起点','product');
    this.note('TemplatesHint',`${customer?`${customer.name} · 预算 ¥${money(customer.budget)}`:'请返回订单选择客户'}\n复制配置、布局、外观与理线，单独制作客户电脑`,330,112,'orders');
    if(!g.state.designs.length)this.empty('EmptyTemplates','还没有保存方案','先创建一款产品，再从已有机型开始接单');
    g.state.designs.slice(this.listPage*3,this.listPage*3+3).forEach((d,i)=>{const y=503+i*193;this.box(this.ui,`Template${d.id}`,360,y,660,178);this.productArt(d.case,112,y,118,148);this.text(this.ui,'TemplateName',d.name,430,y-48,446,46,27);this.text(this.ui,'TemplateState',`${kinds[d.kind]} · 修订 ${d.revision}\n${d.standardized?'标准机型':'保存方案'} · 售价 ¥${money(d.price)}`,353,y+23,292,77,23,C.muted);this.button(this.ui,`UseTemplate${d.id}`,'复制接单',585,y+29,158,()=>this.action(()=>this.openDesign(g.acceptUsingTemplate(this.pendingCustomerId,d.id).id)),true,72,!!customer);});
    this.pagination(g.state.designs.length,3,1072);this.button(this.ui,'BackToOrders','返回委托列表',360,1151,660,()=>this.goto('orders'),false,72);
  }

  private currentReport() {
    const reports=this.model!.state.reports;
    this.reportIndex=this.reportIndex<0?reports.length-1:Math.min(this.reportIndex,reports.length-1);
    return reports[this.reportIndex];
  }
  private reports() {
    const s=this.model!.state,r=this.currentReport();this.heading('ReportHeading',r?`${r.month} 月经营报告`:'经营记录','monthly_report');
    if(r){
      [['销售净收入',`¥${money(r.revenue)}`],['本月利润',`¥${money(r.profit)}`],['月末资金',`¥${money(r.cash)}`],['成功销量',`${r.sold} 台`]].forEach(([label,value],i)=>this.metric('ReportMetric'+i,label,value,193+i%2*334,352+Math.floor(i/2)*139,314,121,i===1&&r.profit<0?C.red:C.orange));
      this.note('ReportCost',`已售及故障成本 ¥${money(r.cogs)} · 固定 ¥${money(r.fixed)} · 研发 ¥${money(r.development)}\n标准产品 ${r.standardSold} 台 · 高定 ${r.commissionSold} 台\n未售 ${r.unsold} 台${r.stockCost===null?'':` · 成品成本 ¥${money(r.stockCost)}`}${r.payables===null?'':` · 待付 ¥${money(r.payables)}`}\n${r.legacyAccounting?'旧版故障账目保留原值，未追溯改写':`销售退款 ¥${money(r.salesRefunds??0)} · 物流 ¥${money(r.logisticsCosts??0)} · 预付退回 ¥${money(r.depositRefunds??0)}`}`,629,128,'cash');
      this.box(this.ui,'ReportFeedbackCard',360,846,660,292,C.panelAlt);this.text(this.ui,'FeedbackTitle',`客户口碑 ${r.reputation.toFixed(1)} · 装配 ${Math.round(r.used.bench)} 工时`,360,741,604,36,25);
      this.text(this.ui,'ReportFeedback',r.feedback.length?r.feedback.slice(0,2).join('\n\n'):'本月没有销售反馈\n可以查看库存，或在设计里查看客群需求',360,836,602,132,24,C.muted);
      this.button(this.ui,'ReportDetails','全部经营反馈',360,942,588,()=>this.goto('reportNotes'),false,62);
      this.button(this.ui,'OlderReport','上个月',138,1046,210,()=>{this.reportIndex=Math.max(0,this.reportIndex-1);this.render();},false,68,this.reportIndex>0);
      this.badge(this.ui,'ReportMonth',`${r.month} / 6 月`,360,1046,168);
      this.button(this.ui,'NewerReport','下个月',582,1046,210,()=>{this.reportIndex=Math.min(s.reports.length-1,this.reportIndex+1);this.render();},false,68,this.reportIndex<s.reports.length-1);
    }else this.empty('NoReport','月结后，记录第一份成绩','收入、成本、利润、库存和客户反馈都会保留','monthly_report',655);
    this.button(this.ui,'ContinueAfterReport',s.closed?'查看经营总结':'返回工坊',360,1149,660,()=>this.goto(s.closed?'ending':'workshop'),true,76);
  }

  private reportNotes() {
    const report=this.currentReport(),rows=report?.feedback||[];this.heading('ReportNotesHeading',`${report?.month||''} 月 · 经营反馈`,'reputation');
    if(!rows.length)this.empty('NoReportFeedback','本月没有销售反馈','完成产品销售或委托交付后，再查看月报','reputation');
    rows.slice(this.listPage*3,this.listPage*3+3).forEach((value,i)=>{const y=409+i*217,n=this.box(this.ui,`ReportNote${i}`,360,y,660,201,C.panelAlt);this.uiIcon(n,'reputation',-274,57,44);this.text(this.ui,'ReportNoteText',value,389,y,550,163,25,C.muted);});
    this.pagination(rows.length,3,1052);this.button(this.ui,'BackToReport','返回月报',360,1141,660,()=>this.goto('reports'),true,76);
  }

  private ending() {
    const g=this.model!,s=g.state,a=g.summary;this.heading('EndingHeading',s.bankrupt?`${a.months} 个月的创业记录`:'六个月 · 品牌经营记录','featured');
    [['产品销量',`${a.sales} 台`],['累计收入',`¥${money(a.revenue)}`],['累计利润',`¥${money(a.profit)}`],['资金余额',`¥${money(a.cash)}`]].forEach(([label,value],i)=>this.metric('EndingMetric'+i,label,value,193+i%2*334,340+Math.floor(i/2)*122,314,108,i===2&&a.profit<0?C.red:C.orange));
    this.note('EndingCustomers',`口碑 ${a.reputation.toFixed(1)} · 交付 ${a.completedCommissions} 份委托${a.averageSatisfaction===null?'':` · 满意度 ${Math.round(a.averageSatisfaction)}`}\n${a.benches} 个工位 · ${a.employees} 名员工 · 每月装配 ${a.capacity.bench} 工时`,591,112,'reputation');
    this.badge(this.ui,'EndingDirection',`经营方向：${{workshop:'小作坊起步',boutique:'精品制作',scale:'规模化生产',mixed:'混合发展'}[a.direction]}`,360,689,560,C.panelAlt,C.orange);
    this.text(this.ui,'RepresentativeHeading','代表作品',360,752,650,38,27);
    if(!a.works.length)this.text(this.ui,'NoWorks','保存的方案仍可查看\n完成的样机会记录在这里',360,875,640,120,25,C.muted,Label.HorizontalAlign.CENTER);
    a.works.slice(0,3).forEach((w,i)=>{const y=817+i*89;this.box(this.ui,`Representative${w.id}`,360,y,660,82);const d=s.designs.find(d=>d.id===w.id);if(d)this.productArt(d.case,89,y,75,70);this.text(this.ui,'WorkSummary',`${w.name} · 修订 ${w.revision}\n${kinds[w.kind]} · 售出 ${w.sold} 台`,356,y,440,68,23);this.button(this.ui,`ViewWork${w.id}`,'查看',610,y,115,()=>this.openDesign(w.id),false,60);});
    this.text(this.ui,'EndingRisk',s.bankrupt?'当月资金无法覆盖开支，本次经营结束':`未售 ${a.stockUnits} 台 · 成品 ¥${money(a.stockCost)} · 配件 ¥${money(a.inventoryCost)}\n待付账款 ¥${money(a.payables)}，留意库存与现金`,360,1082,648,64,22,s.bankrupt?C.red:C.muted,Label.HorizontalAlign.CENTER);
    this.button(this.ui,'EndingReports','查看经营报表',193,1160,314,()=>{this.reportIndex=-1;this.goto('reports');},false,64);this.button(this.ui,'EndingTitle','回到标题',527,1160,314,()=>this.goto('start'),true,64);
  }

}

