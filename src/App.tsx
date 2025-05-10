import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import readmeMd from "../README.md?raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";

function Markdown({
  children,
  remarkPlugins,
  rehypePlugins,
  components,
  ...props
}: Parameters<typeof ReactMarkdown>[number]) {
  const codeComponent: Components = {
    code(props) {
      const { children, className, node, ref: _, ...rest } = props;
      const match = /language-(\w+)/.exec(className || "");
      return match ? (
        <SyntaxHighlighter
          {...rest}
          PreTag="div"
          children={String(children).replace(/\n$/, "")}
          language={match[1]}
          style={atomDark}
        />
      ) : (
        <code {...rest} className={className}>
          {children}
        </code>
      );
    },
  };
  return (
    <ReactMarkdown
      remarkPlugins={[...(remarkPlugins || []), remarkGfm, remarkMath]}
      rehypePlugins={[...(rehypePlugins || []), rehypeSanitize, rehypeKatex]}
      components={{ ...components, ...codeComponent }}
      {...props}
    >
      {children}
    </ReactMarkdown>
  );
}

function App() {
  return (
    <div className="fixed left-0 top-0 w-full h-full flex flex-col justify-center items-center">
      <div className="markdown-body w-[1024px]">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
        >
          {readmeMd}
        </Markdown>
      </div>
    </div>
  );
}

export default App;
