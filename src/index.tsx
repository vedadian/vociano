import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./global.css";

import { About } from "./about.tsx";
import { Main } from "./main.tsx";

import { name } from "../package.json";
import { Layout } from "./layout.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Layout>
      <BrowserRouter basename={`/${name}`}>
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </BrowserRouter>
    </Layout>
  </StrictMode>
);
