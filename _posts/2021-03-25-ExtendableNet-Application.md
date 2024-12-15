---
layout: post
author: Diyaz Yakubov
title: Extendable .Net Application
date: 2021-03-25 20:26:33 UTC
background: https://cdn-images-1.medium.com/max/1024/1*IXggAPHeLtMESIiTdQecSQ.png
excerpt_separator: <!--more-->
---

Contemporary software development requires a high frequency of changes, business’s needs change quite often as well as customers demand more and more features. In this competitive and not stable world, software systems should be able to be modified by requests in a reasonable time. <!--more-->That’s why we see rising dev tools, CI/CD, IDEs, integration tools and etc. Apart from those things, there are also some design methods that may facilitate rapid development. In this article, I’m going to cover a well-known technique which name is plug-in architecture.

Plug-in architecture is an attractive solution for developers seeking to build applications that are modular, customizable, and easily extensible. And a _plug-in_ is a bundle that adds functionality to an application, called the _host application_, through some well-defined architecture for extensibility. This allows developers to add functionality to an application without having access to the source&nbsp;code.[[1]](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/LoadingCode/Concepts/Plugins.html#:~:text=A%20plug%2Din%20is%20a,access%20to%20the%20source%20code.)

This article aims to show a simple approach how to extend a&nbsp;.Net application in a plug-in&nbsp;way.

### Theoretical references

In this article, I decided to skip the theoretical part and jump into the implementation. However, my self-criticism didn’t give me a chance, and I provide some useful links&nbsp;below.

- There is a very brief and concise description of what [plugin architecture](https://cs.uwaterloo.ca/~m2nagapp/courses/CS446/1195/Arch_Design_Activity/PlugIn.pdf) is.
- Here is a very [good material](https://openclassrooms.com/en/courses/6397806-design-your-software-architecture-using-industry-standard-patterns/6896171-plug-in-architecture) of this technique with good theoretical explanations of reasoning and use&nbsp;cases.

They are not too scientific, and I think they give just “enough” knowledge to go&nbsp;further.

### Practice

There are many different ways how devs may approach this architecture, hence, some implementations are very strict or advanced, some of them are quite straightforward. I also have used several techniques to do that, I think the most common is to declare an interface and use it as a “gateway” between libraries. It is a versatile method, and everyone can use it as a swiss knife to build scenarios of any complexity(here is an [example](https://docs.microsoft.com/en-us/dotnet/core/tutorials/creating-app-with-plugin-support)). However, I am going to show an even simpler option. The method is a bit naive and depends on the library, but it might be very handy at the right place and moment. Actually, when the [MediatR](https://github.com/jbogard/MediatR) library is in use. Instead of a developer, it does the dirty work, registers all handlers in given assemblies. So, some common commands and events should be defined in some shared projects. Then, plugin projects use these shared projects and implement the actual behavior. After that, these assemblies will be consumed by MediatR that will register all necessary handlers and their commands/events. The picture below depicts this&nbsp;process.

![](https://cdn-images-1.medium.com/max/1024/1*I-Mc-D73cf7Sc6l4bvwmfg.png)
_Registering handlers to corresponding commands and events_

Actually, it bundles commands/events and handlers at runtime. That means that an application may re-bundle its components every run or every assembly load (it really depends on intention and implementation). Here is my implementation of registering things from loaded assemblies.

![](https://cdn-images-1.medium.com/max/1024/1*fF-XRFm6hbOdMnicJ8WjTQ.png)
_Registering handlers from given assemblies_

As you can see, this approach is very simple and straightforward, especially, for people who are familiar with the MediatR library. I intentionally omitted all code activities in this article because they are very simple. This is a [link](https://github.com/DiyazY/ExtendableDotNetApp) where the source code of the given example might be&nbsp;found.

### Conclusion

To sum up, this is a very simple and to some extent naive way of implementing the plug-in architecture. At the same time, it might be a very powerful and cheap technique if the project already uses the MediatR library. Of course, a decision of using it should be evaluated properly from many aspects, such as risks, project’s scope, maintainability, modifiability, etc. Then, based on pros, cons, and trade-offs the team may take it or just&nbsp;refuse.

 ![](https://medium.com/_/stat?event=post.clientViewed&referrerSource=full_rss&postId=e55596849be3)