import React from 'react';
import {createRoot} from 'react-dom/client';
import Studio from '../app/Studio';
import '../app/globals.css';
import '../app/studio.css';
class Boundary extends React.Component<{children:React.ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(e:Error){return {error:e.message};}render(){return this.state.error?<main className="login-card"><h1>页面需要重新加载</h1><p>已保存的方案和本机恢复副本仍保留。</p><p>{this.state.error}</p><button onClick={()=>location.reload()}>重新加载</button></main>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<Boundary><Studio/></Boundary>);
