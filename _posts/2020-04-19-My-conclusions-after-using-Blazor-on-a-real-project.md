---
layout: post
author: Diyaz Yakubov
title: My conclusions after using Blazor on a real project.
date: 2020-04-19 18:46:33 UTC
background: https://cdn-images-1.medium.com/max/1024/1*Klw3oYkkhK5eGzoLEAWTqQ.png
excerpt_separator: <!--more-->
tags: [net-core, blazor, single-page-applications, csharp, javascript]
original_link: https://medium.com/@diyaz.yakubov/my-conclusions-after-using-blazor-on-a-real-project-993234bdc7b0?source=rss-ce9f85b2b690------2
---

C# and&nbsp;.Net Core have significantly improved in everything (architecture, performance, portability, etc.), and now, we can see how the ecosystem growing fast. <!--more-->In 2019, The Blazor framework was released which extended the&nbsp;.NET ecosystem. I have read many blogs and articles about this framework, and writers mostly made some HelloWorld projects. Despite the fact that some of the authors showed more complex examples, none of these examples seemed realistic. I wondered to use it on a real project, and I thought that it would be super interesting and easy, for a&nbsp;.NET developer, to build a SPA application in such a way (using C# and razor engine). Nevertheless, I found this framework a bit&nbsp;awkward.

The Blazor framework has cons and pros as any other framework, but I want to share drawbacks that I noticed during my&nbsp;project.

![hero image](https://cdn-images-1.medium.com/max/1024/1*Klw3oYkkhK5eGzoLEAWTqQ.png)

> Nov 2022&nbsp;Updates:

> It is getting better certainly 🙂. With the newest&nbsp;.NET 7, the new JavaScript interop functionality was shipped, which can easily invoke&nbsp;.NET code from JavaScript using the&nbsp;.NET WebAssembly runtime, and vice versa. So, it can call JavaScript functionality from&nbsp;.NET. I may conclude that Blazor become more DX-friendly and open. And of course, it has many other improvements, such as performance improvements, more AOT, etc. [This link](https://visualstudiomagazine.com/articles/2022/11/10/aspnet-core-net-7.aspx?m=1) is a good overview of Blazor updates and&nbsp;plans.

> Note: It’s only my vision and thoughts about this framework.

First of all, developers have to know both C# and JS, it’s not true that UI can be built only with C#, as it was mentioned in many articles. The C# is not able to do any DOM manipulations yet. I tried to find some information about C# interacting with DOM, and I also did some experiments. Let’s take my event test as an example. The test was simple, it was an event inspection of Blazor events(e.g. onclick, onchange) where elements were bound to C# methods by special razor tags (unfortunately, it’s very limited). Events were raised from different elements, but there is nothing to discover and inspect, C# events were so poor. So, I think that developers will use JS anyway to design more complex and responsive UI, because with the current Blazor implementation everyone will struggle.

Second, and the most painful, it’s a lack of libraries. The community is too small (in fact, it’s another problem), and it’s difficult to find some fancy and customizable components. For this reason, devs should build them on their own or again use JS components. Nevertheless, there are some premium components from well know companies (syncfusion, telerik, etc.). Pay and enjoy, otherwise, pain and&nbsp;tears.

Finally, Javascript is more expressive and suitable for frontend development than C#. There are so many libs, the community is huge (in my opinion it’s the biggest), and it’s easy to learn and use. As far as we talk about the framework, there are many other UI frameworks that are based on JS/TS, and they are much more popular (big communities, a significant amount of&nbsp;libs).

Despite all of these cons, I like how page navigation and page’s lifecycle are implemented there. I also like the JS interop mechanism, when C# can call JS and vice versa. Basically, it’s not a good or bad framework. It works pretty well. Another thing is that I didn’t notice any performance issues as well as performance increases. So, it just does the&nbsp;job.

In conclusion, the Blazor team has been doing a great job, they made **another framework for building UI** , which is not bad at all. The **idea is brilliant** and all of these modern things are also there (e.g. WASM). Unfortunately, it will be used only by the&nbsp;.NET community, and probably by developers who are struggling with JS. Hence, it will never be used with a broad audience, consequently, there will be fewer developers who want to take this path. Last but not least, it will be just difficult to find and hire a developer for a blazor project in a market. To sum up, if you know JS and want to start a new project with Blazor, don’t use it, at least for now. Maybe later, when the community will be bigger and there will be more free components, you can jump on&nbsp;it.

> Note: I used the Blazor SSR template. The client-side version is not released yet. Furthermore, the framework extends to mobile development and desktop part. It’s interesting, right? I still keep looking at&nbsp;it.

 ![](https://medium.com/_/stat?event=post.clientViewed&referrerSource=full_rss&postId=993234bdc7b0)
Originally posted on [My conclusions after using Blazor on a real project.](https://medium.com/@diyaz.yakubov/my-conclusions-after-using-blazor-on-a-real-project-993234bdc7b0?source=rss-ce9f85b2b690------2)