---
layout: post
author: Diyaz Yakubov
title: Rendering optimization for real-time data on React
date: 2019-10-23 12:53:01 UTC
background: https://cdn-images-1.medium.com/max/1024/1*nmlSKhw0qPLbOi4w1JB5IA.png
excerpt_separator: <!--more-->
tags: [aspnetcore, react, signalr, hooks, rxjs]
original_link: https://medium.com/@diyaz.yakubov/rendering-optimization-for-real-time-data-on-react-5db758951560?source=rss-ce9f85b2b690------2
---

Nowadays some users want to interact with real-time applications which are smooth and with zero delays.<!--more--> From development side I would ask “Why?”, “Is it needed?” “Can we avoid it???!!!” and so on. But some business model needs live data, and this is a reason when we need to use an optimized solution for real-time.

![hero image](https://cdn-images-1.medium.com/max/1024/1*nmlSKhw0qPLbOi4w1JB5IA.png)

I will briefly explain the technology stack, task and of course implementation.

So tech stack (and libs)&nbsp;are:

- Backend:&nbsp;.netcore, signalr;
- Frontend: react, rxjs, @aspnet/signalr;

Task's description is extremely simple: show some measurement or parameter in real-time.

Passing data to a component could be implemented in several ways. I want to show you one use-case which helped me to pass data anywhere. I think my example is perfectly suitable for real-time systems, but of course with some modifications it could be used in other scenarios and also used against redux or passing props (but please don’t use it everywhere).

It will work in this way: backend streams some data, frontend subscribes to that stream and creates a channel(it’s just a stream in a frontend). Channels could be branched(for example you can distinguish data and push them to different sub-channels from the main channel). React components should subscribe to some channel and consume data from it. That’s&nbsp;it.

First of all, we need to create a backend app. Go to a console and type the following commands:

    dotnet new webapi -n backend
    cd backend/
    dotnet add package Microsoft.AspNetCore.SignalR

Go to the project, add a few lines of code and several classes. Modifying Startup looks like&nbsp;this:

![](https://cdn-images-1.medium.com/max/738/1*FVCTkJxidOy486E1gxydKQ.png)
_Startup.cs_

After that add simple Hub and&nbsp;Model:

![](https://cdn-images-1.medium.com/max/994/1*M6bgU-Ybuo9R9cN6EpuD9Q.png)
_MyHub(left) and Payload(right)_

And finally add a method to ValuesController.cs (default controller):

![](https://cdn-images-1.medium.com/max/767/1*5qictoAuErR0kPB5orlc0Q.png)
_ValuesController.cs_

Let's run the app, in the app’s folder type this&nbsp;command:

    dotnet run

If ‘back’ is running — perfect!!! So next is react&nbsp;app.

Go to the console and type these commands:

    npx create-react-app frontend
    cd frontend/
    npm i rxjs
    npm i @aspnet/signalr

After that, we can create two simple services: streamService and signalrService.

![](https://cdn-images-1.medium.com/max/1024/1*OBIcVidh-GbEZbaQ8I0Wmw.png)
_streamService(left) and signalrService(right)_

Basically streamService makes a closure of ‘subjects’, which is a Map of BehaviorSubjects, and provides a kinda high-level API for react components.

signalrService is a little bit more complex, but in general it’s simple too. It makes a closure of hub (signalr hub) and onStreamSubscribers, which is a Map of callback functions. So when some data comes from backend to method “onStream”, the method just calls all callback functions. Actually anything could be in these callback functions, but we will push data to some channel by streamService. See&nbsp;above.

We did our “building blocks”, let's create our implementation. useStreams, it’s a hook to create and stream data to different channels from main&nbsp;stream.

![](https://cdn-images-1.medium.com/max/586/1*d5BmSFphvdwDcYPUa8bXRg.png)
_useStreams.js_

And here is a consumer of a stream, CpuWidget. It subscribes to “\_CPU” channel in a first render (use useEffect with an empty array of dependencies) and updates cpu state when data is pushed to that&nbsp;channel.

![](https://cdn-images-1.medium.com/max/665/1*yoRBrJhb-ce3f5E9gEjo3Q.png)
_CpuWidget.js_

So, basically everything was easy and clear. The components tree was messed up to show how components update (unnecessary nesting).

> Note: I wanted to make a gif with an old react profiler and use highlight updates feature to show how components re-render. But, unfortunately I was too lazy to find a way how to downgrade my current react profiler.

![](https://cdn-images-1.medium.com/max/582/1*F3f03QanEewEWJQlVcu5pw.gif)
_demo_

![](https://cdn-images-1.medium.com/max/969/1*bDU2TAsFG38ibFSNOgq7aw.gif)
_Profiling of passing props_

![](https://cdn-images-1.medium.com/max/969/1*2LUxCSPIfv98eZjuekcUeQ.gif)
_Profiling of stream consuming_

I created a “twin” of that implementation as a react component and gave it a very simple name PropsComponent (first one is a StreamComponent). And here is my estimation and comparison between passing props and stream consuming implementations. For better understanding, you can find these projects on GitHub ([frontend](https://github.com/DiyazY/sc-frontend), [backend](https://github.com/DiyazY/sc-backend)) and play with&nbsp;them.

We can see that stream consuming implementation re-renders much efficiently than passing props implementation. You can imagine some dashboard with many indicators, graphics and any data payload. This solution helped me to reduce complexity and codebase. Because stream can be read from everywhere and you don’t need to define providers, contexts and so on. And adding a new widget it’s so simple. Just add it and implement its logic inside that component that’s it. But there are few drawbacks: extra lib and all these observable things consume resources. But with some compromises and comparing pros and cons show that this solution can do its work very&nbsp;well.

### **Conclusion**

My suggestion is to use this technique when you need to represent real-time data, which are consumed by different UI components which are also deeply nested. If you find another good use-case please write in comments, I will be very grateful.

> Note: don’t use this code on production, it’s just for learning purposes. I kept all things as easy as possible.

> Thanks [Niki](https://medium.com/@nikitagavrilenko) for awesome illustration.

 ![](https://medium.com/_/stat?event=post.clientViewed&referrerSource=full_rss&postId=5db758951560)
Originally posted on [Rendering optimization for real-time data on React](https://medium.com/@diyaz.yakubov/rendering-optimization-for-real-time-data-on-react-5db758951560?source=rss-ce9f85b2b690------2)