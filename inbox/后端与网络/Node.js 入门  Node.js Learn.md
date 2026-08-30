---
title: "Node.js 入门 | Node.js Learn"
source: "https://nodejs.cn/learn/getting-started/introduction-to-nodejs"
author:
published:
created: 2026-08-29
description: "Node.js 是一个免费、开源、跨平台的 JavaScript 运行环境，让开发者可以创建服务器、网页应用、命令行工具和脚本。"
tags:
  - "clippings"
---
<iframe sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation" width="692" height="50" frameborder="0" src="https://googleads.g.doubleclick.net/pagead/ads?client=ca-pub-9051381468277443&amp;output=html&amp;h=50&amp;slotname=1959216408&amp;adk=576175300&amp;adf=3530541886&amp;pi=t.ma~as.1959216408&amp;abgtt=6&amp;w=692&amp;lmt=1786260366&amp;rafmt=12&amp;format=692x50&amp;url=https%3A%2F%2Fnodejs.cn%2Flearn%2Fgetting-started%2Fintroduction-to-nodejs&amp;dt=1787989979202&amp;bpp=3&amp;bdt=1100&amp;idt=3&amp;shv=r20260825&amp;mjsv=m202608260101&amp;ptt=9&amp;saldr=aa&amp;abxe=1&amp;cookie=ID%3D37e63651aa897668%3AT%3D1787989939%3ART%3D1787989939%3AS%3DALNI_MYBuP1ssZnL05g_nKvrQ78fe84Nqg&amp;gpic=UID%3D00001550f25734e7%3AT%3D1787989939%3ART%3D1787989939%3AS%3DALNI_MapRNkso5u0Kr5YvdAQt3nvovcr7Q&amp;eo_id_str=ID%3D7b7cb18602c7e2d7%3AT%3D1787989939%3ART%3D1787989939%3AS%3DAA-AfjaV_mY3r3senhGGDGktD4TN&amp;prev_fmts=0x0&amp;nras=1&amp;correlator=3374956553476&amp;frm=20&amp;pv=1&amp;u_tz=480&amp;u_his=8&amp;u_h=864&amp;u_w=1536&amp;u_ah=816&amp;u_aw=1536&amp;u_cd=24&amp;u_sd=1.25&amp;adx=16&amp;ady=308&amp;biw=724&amp;bih=846&amp;scr_x=0&amp;scr_y=0&amp;eid=95399629%2C95400778%2C95390278%2C122880711%2C122880333&amp;oid=2&amp;pvsid=8948779639861192&amp;tmod=877048040&amp;uas=0&amp;nvt=1&amp;ref=https%3A%2F%2Fnodejs.cn%2Flearn%2F&amp;fc=1920&amp;brdim=-6%2C0%2C-6%2C0%2C1536%2C0%2C754%2C870%2C724%2C846&amp;vis=1&amp;rsz=%7C%7CeE%7C&amp;abl=CS&amp;pfx=0&amp;fu=256&amp;bc=31&amp;bz=1.04&amp;ifi=2&amp;uci=a!2&amp;fsb=1&amp;dtd=10" title="Advertisement" aria-label="Advertisement"></iframe>

## Node.js 入门

🌐 Introduction to Node.js

Node.js 是一个开源的跨平台 JavaScript 运行环境。它是几乎任何类型项目都常用的工具！

🌐 Node.js is an open-source and cross-platform JavaScript runtime environment. It is a popular tool for almost any kind of project!

Node.js 在浏览器外运行 V8 JavaScript 引擎，这是谷歌 Chrome 的核心。这使得 Node.js 性能非常高。

🌐 Node.js runs the V8 JavaScript engine, the core of Google Chrome, outside of the browser. This allows Node.js to be very performant.

Node.js 应用在单个进程中运行，不会为每个请求创建新的线程。Node.js 在其标准库中提供了一组异步 I/O 原语，防止 JavaScript 代码被阻塞。此外，Node.js 中的库通常使用非阻塞范式编写。因此，在 Node.js 中，阻塞行为是例外而不是常态。

🌐 A Node.js app runs in a single process, without creating a new thread for every request. Node.js provides a set of asynchronous I/O primitives in its standard library that prevent JavaScript code from blocking. In addition, libraries in Node.js are generally written using non-blocking paradigms. Accordingly, blocking behavior is the exception rather than the norm in Node.js.

当 Node.js 执行 I/O 操作（如从网络读取、访问数据库或文件系统）时，Node.js 不会阻塞线程并浪费 CPU 周期等待，而是会在响应返回时恢复操作。

🌐 When Node.js performs an I/O operation, like reading from the network, accessing a database or the filesystem, instead of blocking the thread and wasting CPU cycles waiting, Node.js will resume the operations when the response comes back.

这使 Node.js 能够使用单个服务器处理数千个并发连接，而不会带来管理线程并发的负担，这可能是错误的重要来源。

🌐 This allows Node.js to handle thousands of concurrent connections with a single server without introducing the burden of managing thread concurrency, which could be a significant source of bugs.

Node.js 具有独特的优势，因为数百万为浏览器编写 JavaScript 的前端开发者现在能够编写服务器端代码以及客户端代码，而无需学习完全不同的语言。

🌐 Node.js has a unique advantage because millions of frontend developers that write JavaScript for the browser are now able to write the server-side code in addition to the client-side code without the need to learn a completely different language.

在 Node.js 中可以毫无问题地使用新的 ECMAScript 标准，因为你不必等待所有用户更新他们的浏览器 - 你可以通过更改 Node.js 版本来决定使用哪个 ECMAScript 版本，并且还可以通过在运行 Node.js 时使用标志来启用特定的实验性功能。

🌐 In Node.js the new ECMAScript standards can be used without problems, as you don't have to wait for all your users to update their browsers - you are in charge of deciding which ECMAScript version to use by changing the Node.js version, and you can also enable specific experimental features by running Node.js with flags.

## 一个示例 Node.js 应用

🌐 An Example Node.js Application

Node.js 最常见的示例 Hello World 是一个 Web 服务器：

🌐 The most common example Hello World of Node.js is a web server:

```
const { createServer } = require('node:http');

const hostname = '127.0.0.1';
const port = 3000;

const server = createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(\`Server running at http://${hostname}:${port}/\`);
});
```

要运行此代码片段，请将其保存为 `server.js` 文件，并在终端中运行 `node server.js` 。 如果你使用代码的 mjs 版本，应将其保存为 `server.mjs` 文件，并在终端中运行 `node server.mjs` 。

🌐 To run this snippet, save it as a `server.js` file and run `node server.js` in your terminal. If you use the mjs version of the code, you should save it as a `server.mjs` file and run `node server.mjs` in your terminal.

这段代码首先引入了 Node.js 的 [`http` 模块](https://nodejs.cn/api/http.html) 。

🌐 This code first includes the Node.js [`http` module](https://nodejs.cn/api/http.html).

Node.js 拥有出色的 [标准库](https://nodejs.cn/api/) ，包括对网络的顶层支持。

🌐 Node.js has a fantastic [standard library](https://nodejs.cn/api/), including first-class support for networking.

`http` 的 `createServer()` 方法创建一个新的 HTTP 服务器并返回它。

🌐 The `createServer()` method of `http` creates a new HTTP server and returns it.

服务器已设置为在指定的端口和主机名上监听。当服务器准备就绪时，会调用回调函数，在这种情况下，会通知我们服务器正在运行。

🌐 The server is set to listen on the specified port and host name. When the server is ready, the callback function is called, in this case informing us that the server is running.

每当收到新的请求时，会调用 [`request` 事件](https://nodejs.cn/api/http.html#event-request) ，提供两个对象：一个请求（ [`http.IncomingMessage`](https://nodejs.cn/api/http.html#class-httpincomingmessage) 对象）和一个响应（ [`http.ServerResponse`](https://nodejs.cn/api/http.html#class-httpserverresponse) 对象）。

🌐 Whenever a new request is received, the [`request` event](https://nodejs.cn/api/http.html#event-request) is called, providing two objects: a request (an [`http.IncomingMessage`](https://nodejs.cn/api/http.html#class-httpincomingmessage) object) and a response (an [`http.ServerResponse`](https://nodejs.cn/api/http.html#class-httpserverresponse) object).

这两个对象对于处理 HTTP 调用至关重要。

🌐 Those 2 objects are essential to handle the HTTP call.

第一个提供请求详情。在这个简单的示例中，这部分未被使用，但你可以访问请求头和请求数据。

🌐 The first provides the request details. In this simple example, this is not used, but you could access the request headers and request data.

第二个用于将数据返回给调用者。

🌐 The second is used to return data to the caller.

在这种情况下：

🌐 In this case with:

```js
res.statusCode = 200;
```

我们将 `statusCode` 属性设置为 `200` ，以表示响应成功。

🌐 we set the `statusCode` property to `200`, to indicate a successful response.

我们设置了 `Content-Type` 头：

🌐 We set the `Content-Type` header:

```js
res.setHeader('Content-Type', 'text/plain');
```

然后我们关闭响应，将内容作为参数传递给 `end()` ：

🌐 and we close the response, adding the content as an argument to `end()`:

```js
res.end('Hello World');
```

如果你还没有安装，请 [下载](https://nodejs.cn/download) Node.js。

🌐 If you haven't already done so, [download](https://nodejs.cn/download) Node.js.