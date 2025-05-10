import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Theme } from "@radix-ui/themes";
import "./global.css";

import { About } from "./about.tsx";
import { Main } from "./main.tsx";

import { name } from "../package.json";
import { Layout } from "./layout.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Theme>
      <BrowserRouter basename={`/${name}`}>
        <Layout>
          <Routes>
            <Route path="/" element={<Main />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </Theme>
  </StrictMode>
);
