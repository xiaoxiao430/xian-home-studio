import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'西安的家 · 两层空间工作台',description:'调整两层户型、收集空间参考图，逐步完成你的家。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
