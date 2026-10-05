import React from 'react';
import {createRoot} from 'react-dom/client';
import Editor from '../app/Editor';
import seed from '../data/seed.json';
import type {State} from '../lib/model';
import '../app/globals.css';
class Boundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main style={{padding:36}}><h1>页面未完成加载</h1><p>您的本机方案仍保留。请刷新页面重试，或更换完整浏览器打开。</p><button onClick={()=>location.reload()}>重新加载</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<Boundary><Editor initial={seed as State} guest offline/></Boundary>);
