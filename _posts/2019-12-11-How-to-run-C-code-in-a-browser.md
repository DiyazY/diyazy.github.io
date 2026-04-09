---
layout: post
author: Diyaz Yakubov
title: How to run C# code in a browser.
date: 2019-12-11 20:03:01 UTC
background: https://cdn-images-1.medium.com/max/1024/1*7ShYHmJbf7W3HZ7Q09KV8Q.png
excerpt_separator: <!--more-->
tags: [webassembly, wasm, csharp, javascript, dotnet]
original_link: https://medium.com/@diyaz.yakubov/how-to-run-c-code-in-a-browser-15d2c0c8bed3?source=rss-ce9f85b2b690------2
---

Nowadays, there are a lot of talks about WebAssembly and how it would penetrate the front-end world. In fact, it has not yet. There are tons of articles about web assembly and how it works. I want to show you a use-case of running C# code in<!--more--> a&nbsp;browser.

![hero image](https://cdn-images-1.medium.com/max/1024/1*7ShYHmJbf7W3HZ7Q09KV8Q.png)

> Nov 2022&nbsp;Updates:

> Apparently, it took 3 years to make&nbsp;.NET WASM publicly available for the JavaScript community. Congrats 🎉🎉🎉!!! Finally, we don’t have to struggle with custom implementations, no need to juggle anymore. In the autumn of 2022, Microsoft released&nbsp;.NET 7 and a lot of other following related updates. Now, we have a new template wasmbrowser which is in a new experimental template from wasm-experimental. Basically, the new JavaScript interop can easily invoke&nbsp;.NET code from JavaScript using the&nbsp;.NET WebAssembly runtime, and vice versa. So, it can call JavaScript functionality from&nbsp;.NET. And all of these are without the Blazor. Amazing 🤩! My suggestion is don’t waste your time on this article, it was relevant 3 years ago. Now, it is better to follow [this link](https://devblogs.microsoft.com/dotnet/use-net-7-from-any-javascript-app-in-net-7/)! Though you can leave claps 👏 at the end of this article 😅. Good luck my&nbsp;friend!

> Short description from the MDN: WebAssembly is a new type of code that can be run in modern web browsers — it is a low-level assembly-like language with a compact binary format that runs with near-native performance and provides languages such as C/C++ and Rust with a compilation target so that they can run on the web. It is also designed to run alongside JavaScript, allowing both to work together.

There are several ways how to do it. I would like to mention three of&nbsp;them.

- The first one is to use a Blazor Framework. It hides the complexity and gives a solid tool for building SPA applications (there is a very good article about [WebAssembly and&nbsp;Blazor](https://www.codemag.com/article/1809061/Re-Assembling-the-Web-with-Web-Assembly-and-Blazor)).
- The second way is to use a mono-wasm compiler and compile your code to a WASM file. It does Ahead of Time compilation and it works very well (there is an article about [MONO and WASM](https://www.mono-project.com/news/2018/01/16/mono-static-webassembly-compilation/) and a good explanation of how mono compiles C# into&nbsp;wasm).
- The third scenario is to run&nbsp;.Net libraries in a browser, as a Blazor framework does, but without Blazor. As was mentioned in the article above, there is a very good explanation of how [Blazor works](https://www.codemag.com/article/1809061/Re-Assembling-the-Web-with-Web-Assembly-and-Blazor). Furthermore, it tells that for running&nbsp;.net assemblies we need a mono-compiled version of the&nbsp;.NET Runtime which was compiled to a WASM module to execute&nbsp;.NET Standard modules. Is it overhead? Of course, there are some lacks. To be honest, I don’t know. We will see&nbsp;;).

Another question is: “Do we really need it?”. The 3rd scenario might be useful for someone who wants to upgrade a front-end app and play with it. Nevertheless, I recommend using AoT compiled wasm file with React, Angular or Vue applications. Blazor framework can be even used if a project has just&nbsp;started.

Here is an example of how to use this approach. There is a react-based front-end application, which is hosted by NodeJs (of course, there are no talks about Blazor). Users can load any&nbsp;.Net standard modules(library assemblies) and retrieve metadata from them or even call some methods and use results for configuring higher modules. Assemblies represent small modules with some logic and certain responsibility (Ex.: calculation of material strength). There are some dynamic behaviours and reflections that’s why developers can’t use AOT compilation for it. Passing and retrieving assemblies, and relative data through HTTP is a heavy payload. Assemblies shouldn’t be saved somewhere, they should be extracted and executed, and that’s&nbsp;it.

![](https://cdn-images-1.medium.com/max/1024/1*BR9WEOncgbtyIV2nbH4vFw.png)

Before going forward I want to define a task: Recreate the example case mentioned above.

Let’s create a web application:

    dotnet new web -n playDllAndWasm

Next, create the “wwwroot” folder within index.html file, and modify the Startup.cs file as shown&nbsp;below.

![](https://cdn-images-1.medium.com/max/749/1*lhtWuu5rppi4mrxjkmXzJQ.png)
_Startup.cs_

Furthermore, We need to add precompiled WASM&nbsp;.Net runtime (mono-wasm) and the mono script (mono.js) to run it. You can get them from the [mono-wasm GitHub](https://github.com/migueldeicaza/mono-wasm) page. There is also a link to [Binary releases](https://github.com/migueldeicaza/mono-wasm/releases). Get a [packager](https://github.com/mono/mono/blob/master/sdks/wasm/docs/packager.md) and use it to generate the whole bunch of libraries for running the&nbsp;.NET module. I have done all of these, but here is my suggestion: if you want to play around and not kill yourself, you can easily clone this [demo project&nbsp;repo](https://github.com/DiyazY/CSharpToWasm).

> Note: If you want to play with mono-wasm AOT compilation you have to deal with packager. There are might be some changes, as it is under development.

After that, let’s create a “managed” folder which will contain all&nbsp;.Net assemblies. Put there the first and the most important assembly — “mscorlib.dll”. We need it to run assemblies because it is a Multilanguage Standard Common Object Runtime Library. Go forward and add an index.html file to the “wwwroot” folder and modify it as it is shown&nbsp;below.

![](https://cdn-images-1.medium.com/max/695/1*1mjK8dREEvftdGn98btzoQ.png)
_index.html_

What does the code above? The first script tag creates an empty object “Module” and declares only one method where we can place calls to the MONO instance. Through the MONO instance, developers can configure and act with the&nbsp;.Net world. The second script tag loads mono.js file that contains commands which load and run mono.wasm. In addition, it triggers “onRuntimeInitialized” when everything is initialized (for ex.: MONO instance)and prepared to work. Run and see what it&nbsp;does.

![](https://cdn-images-1.medium.com/max/632/1*B1OWoEfQuDSKIRQQ7JOSJA.png)
_The first running._

It shows only “Hello world!”. However, if you open a dev console you’ll see some logs from the mono. It tells us that the runtime environment is ready which consequently shows that we can continue the development.

Next, we need to create our first, but not last,&nbsp;.Net standard module and run it. Let’s execute the next&nbsp;command:

    dotnet new classlib -n SomeComputing

There will be only one class with the code&nbsp;below:

![](https://cdn-images-1.medium.com/max/583/1*7CcvCVxIWM15gljcnWg5ow.png)
_TestComputing.cs_

Index.html should be modified. Now it needs some extra libraries to be able to point what to call, and of course our “SomeComputing” library. Check out the&nbsp;changes:

![](https://cdn-images-1.medium.com/max/1024/1*f37mCQ4qvEmEiHD4zzmCfg.png)
_Part of index.html_

The function above initializes&nbsp;.Net WebAssembly bindings and points to a method which should be called. If it runs, the dev console will show you the result of the method execution.

![](https://cdn-images-1.medium.com/max/628/1*iUcwN3ujbe9cyP2FLlkECw.png)
_The result of calling the Execute method from C# TestCompution class._

A common way of calling some&nbsp;.Net functionality was implemented above. It could be done by mono-wasm AoT compilation and got only one WASM file, without any&nbsp;.Net assembly dependencies. For continuing the development, the front-end needs some extra libraries. Create several new netstandard projects:

    dotnet new classlib -n CommonLibrary
    dotnet new classlib -n ComputeFibonacci
    dotnet new classlib -n ComputeDateTimes

A “CommonLibrary” project has only one&nbsp;.cs file with an interface.

![](https://cdn-images-1.medium.com/max/454/1*Bwm8zPbR5bvF0XfJHUH4ZQ.png)
_IExecutable interface._

The “IExecutable” interface is an assembly’s entry point. The “Execute” method is a common declaration of methods that will be executed on a front-end side. “ComputeFibonacci” and “ComputeDateTimes” projects will depend on the “CommonLibrary” project. Next, add a new class to SomeComputing project that will load assemblies and run&nbsp;them.

![](https://cdn-images-1.medium.com/max/835/1*FEZWtY7mfr4b64Cb2zI1Dw.png)
_Computing.cs_

WebAssembly can’t pass any complex data structures. In addition, we can not pass assemblies or bytes. Javascript itself writes bytes in an allocated buffer and sends a pointer to the&nbsp;.NET module.&nbsp;.Net module, in its turn, will take care of reading this buffer, converting bytes to some structure (in our case it’s an assembly) and processing a certain&nbsp;job.

![](https://cdn-images-1.medium.com/max/1024/1*I3Xpv4XVRl_8Xrvw4daAgg.png)
_Part of index.html_

> A response can be written in some buffer and retrieved as a pointer. After that, this buffer can be read in JavaScript directly. Nevertheless, I’m a lazy person and I think you got the main idea of passing and retrieving. That’s why the “executeMethod” returns a string value. Simple and crutch&nbsp;;).

ComputeFibonacci and ComputeDateTimes contain only one class that implements the“IExecutable” interface.

![](https://cdn-images-1.medium.com/max/1024/1*teKwXjQ9k7VWRVfmKHuM8w.png)
_DateTimeComputing.cs (left side) and FibonacciComputing.cs (right side)._

These two projects should be built and their assemblies should be taken for loading and execution. Ohh right, I think it’s time for a&nbsp;demo.

![](https://cdn-images-1.medium.com/max/951/1*bR9dR-quNwGcpEiCXxCVFQ.gif)
_Demo!_

![](https://cdn-images-1.medium.com/max/1024/1*UJIK_l2lXdLLs7gW-AbzPQ.png)

This technology is pretty young. It has many issues but it also shows potential. It is a fast, safe, light, portable and open standard. In this article, I wanted to show one of the “use cases” of this technology. This article is more about encouraging. In my opinion, we will see some new libraries or even frameworks which will be based on WASM. There is also good news about the fourth language for the Web. So, don’t waste time, jump on a train&nbsp;:).

> Thanks [Niki](https://medium.com/@nikitagavrilenko) for awesome illustration.

 ![](https://medium.com/_/stat?event=post.clientViewed&referrerSource=full_rss&postId=15d2c0c8bed3)
