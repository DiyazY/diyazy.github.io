---
layout: post
author: Diyaz Yakubov
title: "The Hidden Cost of the Cloud - How Digital Storage is Draining Energy"
date: 2025-02-04 15:28:46 UTC
background: https://cdn-images-1.medium.com/max/800/1*zIzEaLhkUALFJEHS4dAw1g.png
excerpt_separator: <!--more-->
tags: [electricity, ai, data, data-center, environmental-impact]
original_link: https://medium.com/aimonks/the-hidden-cost-of-the-cloud-how-digital-storage-is-draining-energy-ccc1bd0ad783?source=rss-ce9f85b2b690------2
---

Have you ever considered the environmental impact of digital activities? It's a fascinating topic, especially in our digital era, where many use technology daily but may not fully understand how it works — or its broader implications. Even those familiar with tech might overlook its environmental side. That's why understanding the impact of technology on the environment (ToE) is so important.

<!--more-->

At first, this might seem complex, but the core ideas are straightforward. I'll break them down using simple examples and clear explanations, so no technical background is needed.

Take a popular messaging app on your phone as an example. When you send a message, it travels through a series of network devices — like routers and switches — before reaching a server. This server stores, processes, and manages your message. To ensure reliability, the message is often replicated across multiple servers, creating backups. This redundancy ensures your message is safe; even if one server fails, you can still access your data seamlessly. The illustration below shows how this process works.

![Simplified view of a messenger application flow — sequence diagram.](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*YNYT63G5DZNwbE9r7rD8Qg.png)

In a sequence diagram, each actor is not tied to a fixed number. The message-sending process could involve 10 devices — or 100. Viewed from another angle, the complexity of this flow becomes evident.

![Simplified view of a messenger application flow — action diagram.](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*oAXWE3iXM2JHuKZdwywOMA.png)

However, the brilliance of technology lies in its ability to hide this complexity. The user interface simplifies everything, allowing us to send and receive data effortlessly without seeing the intricate processes behind the scenes. Today, transferring gigabytes [\[3\]](https://davidmytton.blog/how-much-energy-do-data-centers-use/) of data is seamless, and as data usage grows exponentially, our world becomes increasingly data-driven and intelligent.

![Simple UI that hides all the complexity of modern tech.](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*RwzStw_0x_vKvmQUJwwGkw.png)

It's often said that "data is the oil of modern life," but there's another, often-overlooked factor: electricity. I like to think of electricity as the oxygen that powers all these technologies. Energy-intensive innovations like AI, blockchain, and electric vehicles (EVs) are driving electricity demand, which can lead to shortages and, more importantly, significant environmental impacts.

Recent analyses [\[5\]](https://greenly.earth/en-us/blog/ecology-news/what-is-the-carbon-footprint-of-data-storage) indicate that storing 1 GB of data in the cloud consumes approximately 0.1 kilowatt-hours (kWh) of electricity per year. This figure accounts for significant improvements in data center energy efficiency compared to earlier estimates, which ranged from 3 to 7 kWh per GB annually.

To put this into perspective, a typical household in the UK consumes about 2,700 kWh of electricity annually. Therefore, storing 1 terabyte (TB) of data in the cloud would account for approximately 100 kWh per year, representing around 3.7% of the average household's annual electricity consumption.

It's important to note that these figures can vary based on factors such as the energy efficiency of specific data centers and the local electricity mix. Nonetheless, as our reliance on cloud storage grows, so does its cumulative environmental impact.

Beyond electricity usage, data centers generate considerable digital waste, such as worn-out or broken hardware components. Hard drives, for example, have a limited lifespan and must be replaced after a certain period, regardless of their condition.

> The more data we generate and store, the more energy we consume, and the larger our environmental footprint grows.

Recently, I came across a research paper discussing the ethical use of online services. It sparked my curiosity and led me to explore the topic further. To my surprise, despite the growing importance of this issue, it remains largely overlooked. This is my small contribution to shedding light on it.

> So, what can we do? You might wonder.

On a personal level, we can focus on reducing energy consumption — using energy-efficient appliances and being mindful of electricity usage at home. But does this mean we need to abandon modern technology and convenient online services? Not at all. Instead, we should strive to use them more consciously.

For instance, many of us unknowingly have "zombie resources" — services [\[4\]](https://www.deloitte.com/uk/en/Industries/power-utilities-renewables/blogs/revealing-the-hidden-carbon-footprint-of-the-cloud.html) or accounts we once used but abandoned long ago. These inactive resources still consume energy and occupy space. Take a moment to identify and clean them up.

Another growing trend is AI prompting, which is becoming a popular way to search for information. However, AI systems consume significantly more energy than traditional searches — often 10 to 100 times more [\[1\]](https://www.bluestrike-group.com/post/analysis-of-the-energy-consumption-associated-with-generative-ai-searches) [\[2\]](https://www.euronews.com/next/2023/11/01/ai-chatgpt-consumes-more-energy-than-a-traditional-internet-search). If the query is trivial, consider using a standard search engine instead.

Additionally, not everything needs to be stored in the cloud. Local storage is thousands of times more energy-efficient and can be powered down when not in use. Similarly, when it comes to communication, text messages are far smaller in size compared to video or audio messages. If the message can be text-based, consider typing or using your phone's speech-to-text feature.

As we've seen, every digital action — no matter how seamless — burns electricity at every step of its journey. While technology continues to evolve, we must recognize that energy efficiency in modern tools is still a work in progress.

Until more sustainable innovations are developed, it's on us to be mindful of our energy usage. Behind every sleek and engaging user interface lies hidden resource consumption. By being conscious of this, we can reduce our environmental impact while continuing to enjoy the benefits of the digital age.

## References

[\[1\] **Energy Consumption of AI Searches vs. Traditional Searches**: AI-powered search engines, such as those utilizing GPT-4, consume significantly more energy due to the computational power required. A single AI search query can consume up to 10 times more energy than a traditional search.](https://www.bluestrike-group.com/post/analysis-of-the-energy-consumption-associated-with-generative-ai-searches)

[\[2\] **Energy Consumption of Data Centers**: Data centers, essential for AI training, account for almost 1% of the world's energy consumption. This figure is set to rise over the next few years.](https://www.euronews.com/next/2023/11/01/ai-chatgpt-consumes-more-energy-than-a-traditional-internet-search)

[\[3\] Energy Consumption of Data Transmission: The energy required to transmit data over the internet varies, with estimates suggesting that transferring 1 GB of data can consume between 0.0064 kWh to 136 kWh, depending on the method and distance of transmission.](https://davidmytton.blog/how-much-energy-do-data-centers-use)

[\[4\] **Energy Consumption of Cloud Services**: While employees may not think about the emissions associated with cloud services, the energy consumption and emissions generated through their use of email, cloud storage, and collaboration technologies still contribute to their company's scope 3 emissions.](https://www.deloitte.com/uk/en/Industries/power-utilities-renewables/blogs/revealing-the-hidden-carbon-footprint-of-the-cloud.html)

[\[5\] **Energy Consumption of Cloud Storage**: Storing data in the cloud requires energy for data transmission and storage. Estimates suggest that storing 1 GB of data in the cloud consumes approximately 0.1 kWh per year.](https://greenly.earth/en-us/blog/ecology-news/what-is-the-carbon-footprint-of-data-storage)
