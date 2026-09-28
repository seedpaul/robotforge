import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"RobotForge — FRC Robot Studio",description:"Configure your FRC robot, map controls, build commands, plan autonomous paths, and export a robot project.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
