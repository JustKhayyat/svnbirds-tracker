import "../styles/globals.css";
import { Bebas_Neue, Inter } from "next/font/google";

const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function MyApp({ Component, pageProps }) {
  return (
    <main className={`${bebas.variable} ${inter.variable}`}>
      <Component {...pageProps} />
    </main>
  );
}
