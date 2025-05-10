import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import readmeMd from "../README.md?raw";

function App() {
  return (
    <div className="fixed left-0 top-0 w-full h-full flex flex-col justify-center items-center">
      <div className="markdown-body w-[1024px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {readmeMd}
      </ReactMarkdown>
      </div>
    </div>
  );
}

export default App;
