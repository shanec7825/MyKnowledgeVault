"use strict";
const { Plugin, FileView, Notice, TFile } = require("obsidian");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const VIEW = "vault-html-webviewer-redirect";
const MIME = {
 ".html":"text/html; charset=utf-8",".htm":"text/html; charset=utf-8",
 ".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".mjs":"text/javascript; charset=utf-8",".svg":"image/svg+xml",
 ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",
 ".gif":"image/gif",".webp":"image/webp",".ico":"image/x-icon",
 ".woff":"font/woff",".woff2":"font/woff2",
 ".mp3":"audio/mpeg",".m4a":"audio/mp4",".mp4":"video/mp4",".pdf":"application/pdf"
};
class HtmlView extends FileView {
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;}
 getViewType(){return VIEW;}
 getDisplayText(){return this.file?.basename || "本地 HTML 课程";}
 getIcon(){return "globe";}
 async onLoadFile(file){
   this.contentEl.empty();
   this.contentEl.style.cssText="padding:0;display:flex;flex-direction:column;height:100%;overflow:hidden";
   const bar=this.contentEl.createDiv();
   bar.style.cssText="display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:7px 10px;border-bottom:1px solid var(--background-modifier-border);background:var(--background-primary)";
   const text=bar.createSpan({text:file.name});
   text.style.cssText="flex:1;min-width:170px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
   const make=(label,icon,action)=>{
     const btn=bar.createEl("button",{text:label,attr:{"aria-label":label}});
     btn.addClass("clickable-icon");
     btn.setAttribute("title",label);
     btn.onclick=()=>Promise.resolve().then(action).catch(e=>new Notice("HTML 操作失败："+e.message,7000));
     return btn;
   };
   const frame=this.contentEl.createEl("iframe",{attr:{
     title:"本地学习伴侣："+file.basename,src:this.plugin.urlFor(file),
     sandbox:"allow-scripts allow-same-origin allow-forms"
   }});
   frame.style.cssText="display:block;flex:1;width:100%;height:100%;border:0;background:#f7f5f0";
   make("刷新","refresh-cw",()=>{frame.src=this.plugin.urlFor(file)+(this.plugin.urlFor(file).includes("?")?"&":"?")+"reload="+Date.now()});
   make("网页查看器","globe",()=>this.plugin.openHtml(file,this.leaf));
   make("外部浏览器","external-link",()=>this.plugin.openExternal(file));
   const tip=this.contentEl.createDiv({text:"若显示空白，点击“网页查看器”，或“外部浏览器”。首次打开请确认已启用社区插件 Vault HTML Web Viewer。"});
   tip.style.cssText="font-size:11px;line-height:1.5;padding:4px 10px;background:var(--background-secondary);color:var(--text-muted)";
 }
 async onUnloadFile(){this.contentEl.empty();}
}
module.exports=class VaultHtmlWebViewer extends Plugin{
 async onload(){
   const adapter=this.app.vault.adapter;
   if(typeof adapter.getBasePath!=="function"){
     new Notice("Vault HTML Web Viewer 仅支持桌面本地文件库",7000);return;
   }
   this.root=await fs.realpath(adapter.getBasePath());
   const saved=await this.loadData()||{};
   // NEVER persist the local HTTP bearer token into Git / plugin data.
   this.token=randomBytes(32).toString("hex");
   this.server=http.createServer((req,res)=>this.serve(req,res).catch(err=>{
     console.error("HTML viewer server:",err);
     if(!res.headersSent)res.writeHead(500);
     res.end();
   }));
   this.register(()=>{this.server.close();this.server.closeAllConnections?.()});
   const listen=port=>new Promise((resolve,reject)=>{
      const onError=e=>{this.server.removeListener("listening",onListening);reject(e)};
      const onListening=()=>{this.server.removeListener("error",onError);resolve()};
      this.server.once("error",onError);
      this.server.once("listening",onListening);
      this.server.listen(port,"127.0.0.1");
   });
   try{await listen(saved.port||27189)}
   catch(err){if(err.code!=="EADDRINUSE")throw err;await listen(0)}
   this.port=this.server.address().port;
   await this.saveData({port:this.port});
   this.registerView(VIEW,leaf=>new HtmlView(leaf,this));
   this.registerExtensions(["html","htm"],VIEW);
   this.addCommand({id:"open-current-html-in-webviewer",name:"Open current HTML in built-in Web viewer",checkCallback:checking=>{
     const file=this.app.workspace.getActiveFile();
     if(!(file instanceof TFile)||!/^html?$/i.test(file.extension))return false;
     if(!checking)this.openHtml(file).catch(e=>new Notice(e.message,7000));
     return true;
   }});
   this.registerEvent(this.app.workspace.on("file-menu",(menu,file)=>{
      if(!(file instanceof TFile)||!/^html?$/i.test(file.extension))return;
      menu.addItem(item=>item.setTitle("在网页查看器打开 HTML").setIcon("globe").onClick(()=>this.openHtml(file).catch(e=>new Notice(e.message,7000))));
      menu.addItem(item=>item.setTitle("在系统浏览器打开 HTML").setIcon("external-link").onClick(()=>this.openExternal(file).catch(e=>new Notice(e.message,7000))));
   }));
 }
 urlFor(file){
   if(!(file instanceof TFile))throw new Error("未找到本地 HTML 文件；请先同步仓库");
   return "http://127.0.0.1:"+this.port+"/"+this.token+"/"+file.path.split("/").map(encodeURIComponent).join("/");
 }
 async openHtml(file,leaf){
   const dest=leaf||this.app.workspace.getLeaf("tab");
   try{
      await dest.setViewState({type:"webviewer",state:{url:this.urlFor(file),title:file.basename,navigate:true},active:true});
      this.app.workspace.revealLeaf(dest);
   }catch(e){
      // The local HTML FileView is still a usable fallback if the core Web viewer is disabled.
      await dest.setViewState({type:VIEW,state:{file:file.path},active:true});
      this.app.workspace.revealLeaf(dest);
      new Notice("网页查看器不可用，已改用内嵌 HTML 预览。",5000);
   }
 }
 async openExternal(file){
   const {shell}=require("electron");
   await shell.openExternal(this.urlFor(file));
 }
 async serve(req,res){
   const deny=n=>{res.writeHead(n);res.end()};
   if(req.headers.host!=="127.0.0.1:"+this.port)return deny(403);
   if(!["GET","HEAD"].includes(req.method))return deny(405);
   let pathname;
   try{pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname)}
   catch{return deny(400)}
   const prefix="/"+this.token+"/";
   if(!pathname.startsWith(prefix))return deny(403);
   const relative=pathname.slice(prefix.length);
   if(!relative||relative.includes("\\")||relative.includes("\0")||relative.split("/").some(p=>p.startsWith(".")))return deny(403);
   const filePath=path.resolve(this.root,relative);
   let real;
   try{real=await fs.realpath(filePath)}
   catch(e){return deny(["ENOENT","ENOTDIR"].includes(e.code)?404:500)}
   const inside=path.relative(this.root,real);
   if(inside.startsWith(".."+path.sep)||inside===".."||path.isAbsolute(inside))return deny(403);
   if(inside.split(path.sep).some(p=>p.startsWith(".")))return deny(403);
   const type=MIME[path.extname(real).toLowerCase()];
   if(!type)return deny(403);
   const st=await fs.stat(real);
   if(!st.isFile())return deny(404);
   res.setHeader("Content-Type",type);
   res.setHeader("Cache-Control","no-cache");
   res.setHeader("X-Content-Type-Options","nosniff");
   res.setHeader("Referrer-Policy","no-referrer");
   res.setHeader("Access-Control-Allow-Origin","http://127.0.0.1:"+this.port);
   if(req.method==="HEAD"){res.writeHead(200);res.end();return}
   res.writeHead(200);
   res.end(await fs.readFile(real));
 }
};