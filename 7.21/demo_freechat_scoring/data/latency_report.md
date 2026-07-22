# Realtime Conversation Performance Report

Durations are measured in the browser with `performance.now()`.

## Acceptance targets

| Metric | Target |
|---|---:|
| User speech start → first transcript text | ≤ 500 ms |
| User speech end → first audible AI audio | ≤ 1200 ms |
| User interruption → AI audio becomes silent | ≤ 300 ms |
| User speech end → first AI text | ≤ 800 ms |
| Continuous conversation on a normal network | 3–10 min without obvious stutter |

## Per-turn measurements

| Time | Conversation | Turn | Level | Start→transcript | End→audio | Interrupt→silent | End→text | Total turn | Learner | AI |
|---|---|---:|---|---:|---:|---:|---:|---:|---|---|
| 2026-07-10T06:57:59.252Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 7656 |  | Hi there, I'm your English speaking coach. Let's get started with something simple. What did you have for breakfast this |
| 2026-07-10T06:58:22.445Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 5707 |  | Hi there, I'm your English speaking coach. Did you have a good breakfast this morning? |
| 2026-07-10T06:58:30.275Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 381 ✅ | 754 ✅ | — | 267 ✅ | 3758 | I had rice and chicken for lunch today. | That sounds like a solid meal. Did you cook it yourself or buy it? |
| 2026-07-10T06:58:52.993Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 4790 |  | Hello, I'm your English speaking coach. Did you have a good breakfast this morning? |
| 2026-07-10T06:58:59.757Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 318 ✅ | 788 ✅ | — | 310 ✅ | 4511 | I had rice and chicken for lunch today. | That sounds like a good meal. Did you cook the chicken yourself or buy it? |
| 2026-07-10T07:01:26.420Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 7961 |  | Hi there, I'm your English speaking coach. Let's chat about your day. What is one thing you are looking forward to today |
| 2026-07-10T07:01:59.874Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 7385 |  | Hello, I'm your English speaking coach. Let's start with something simple. What did you have for breakfast this morning? |
| 2026-07-10T07:02:12.972Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 4774 |  | Hi, I'm your English speaking coach. Did you have a good breakfast this morning? |
| 2026-07-10T07:02:19.255Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 282 ✅ | 766 ✅ | — | 233 ✅ | 5287 | I had rice and chicken for lunch today. | That sounds like a solid meal. Did you cook the chicken yourself or get it from somewhere? |
| 2026-07-10T07:02:32.568Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 5748 |  | Hi, I’m your English speaking coach. Let’s start with something simple. What did you have for breakfast today? |
| 2026-07-10T07:02:39.697Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 312 ✅ | 671 ✅ | — | 158 ✅ | 3981 | I had rice and chicken for lunch today. | That sounds like a solid meal. Did you cook it yourself or get it from somewhere? |
| 2026-07-10T07:05:26.952Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 5637 |  | Hi there, I'm your English speaking coach. What's one thing you're looking forward to doing this weekend? |
| 2026-07-10T07:05:35.225Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 214 ✅ | 703 ✅ | — | 154 ✅ | 3674 | I had rice and chicken for lunch today. | That sounds like a good meal. Did you cook it yourself or buy it? |
| 2026-07-10T07:06:05.862Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 7453 |  | Hi, I’m your English speaking coach. Let’s start with something simple. What did you have for breakfast this morning? |
| 2026-07-10T07:06:30.460Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 5758 |  | Hi there, I'm your English speaking coach. What's one thing you're looking forward to doing this weekend? |
| 2026-07-10T07:06:37.838Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 322 ✅ | 769 ✅ | — | 239 ✅ | 4467 | I had lunch and I had rice and chicken for lunch today. | That sounds like a good meal. Did you cook the chicken yourself or buy it? |
| 2026-07-10T07:06:55.570Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 10234 |  | Hi there, I'm your English speaking coach. Let's get started by talking about your morning routine. What was the first t |
| 2026-07-10T07:07:07.623Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 176 ✅ | 778 ✅ | — | 237 ✅ | 4391 | I had rice and chicken for lunch today. | That sounds like a solid meal. Did you cook it yourself or get it from somewhere? |
| 2026-07-10T07:07:43.286Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 6804 |  | Hello, I'm your English speaking coach. Let's chat about your day. What is one thing you plan to do later today? |
| 2026-07-10T07:07:52.037Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 207 ✅ | 723 ✅ | — | 245 ✅ | 3482 | I feel nervous because I will give a presentation tomorrow. | That's completely normal. What is your presentation about? |
| 2026-07-10T07:08:14.513Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 7038 |  | Hi there, I'm your English speaking coach. Let's get started with a simple topic. What did you have for breakfast this m |
| 2026-07-10T07:08:22.949Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 281 ✅ | 296 ✅ | — | 7 ✅ | 2968 | I feel nervous because I will give a presentation tomorrow. | That's completely normal. What is your presentation about? |
| 2026-07-10T07:08:40.937Z | 024df5a1a37941ab8ddf | 1 | CET-4 (B1-B2) | — | — | — | — | 7354 |  | Hi there, I'm your English speaking coach. Let's chat about your day. What was the most interesting thing you did this m |
| 2026-07-10T07:08:51.268Z | 024df5a1a37941ab8ddf | 2 | CET-4 (B1-B2) | 228 ✅ | 1242 ❌ | — | 292 ✅ | 3088 | I feel nervous because I will give a presentation tomorrow. | That's completely normal. What is your presentation about? |
| 2026-07-10T07:09:07.139Z | 7bb1d826c0ea475abe95 | 1 | CET-4 (B1-B2) | — | — | — | — | 7534 |  | Hi, I’m your English speaking coach. Let’s talk about your day. What was the most interesting thing you did this morning |
| 2026-07-10T07:09:16.370Z | 7bb1d826c0ea475abe95 | 2 | CET-4 (B1-B2) | 396 ✅ | 824 ✅ | — | 236 ✅ | 3511 | I feel nervous because I will give a presentation tomorrow. | That's completely normal. What is your presentation about? |
| 2026-07-10T07:09:33.032Z | 0c306b9aeba541838e8f | 1 | CET-4 (B1-B2) | — | — | — | — | 7344 |  | Hi there, I'm your English speaking coach. Let's start with something simple. What did you have for breakfast this morni |
| 2026-07-10T07:09:41.486Z | 0c306b9aeba541838e8f | 2 | CET-4 (B1-B2) | 272 ✅ | 780 ✅ | — | 207 ✅ | 3435 | I feel nervous because I will give a presentation tomorrow. | That's completely normal. What is your presentation about? |
| 2026-07-10T07:10:33.001Z | 564dc7fe93744f20b3ed | 1 | CET-4 (B1-B2) | — | — | — | — | 5433 |  | Hi there, I'm your English speaking coach. What's one thing you're looking forward to doing this weekend? |
| 2026-07-10T07:10:40.267Z | 564dc7fe93744f20b3ed | 2 | CET-4 (B1-B2) | 315 ✅ | 777 ✅ | — | 198 ✅ | 4413 | My name is Leo, and I had a busy day. | Hi Leo, nice to meet you. What was the busiest part of your day? |
| 2026-07-10T07:10:49.910Z | 564dc7fe93744f20b3ed | 3 | CET-4 (B1-B2) | 98 ✅ | 766 ✅ | — | 235 ✅ | 5338 | I had three meetings this morning. | That sounds like a lot. Was there one meeting that was more important than the others? |
| 2026-07-10T07:10:59.688Z | 564dc7fe93744f20b3ed | 4 | CET-4 (B1-B2) | 221 ✅ | 812 ✅ | — | 324 ✅ | 4736 | The second meeting was the most difficult. | Oh, that sounds tough. What made it so difficult for you? |
| 2026-07-10T07:11:10.588Z | 564dc7fe93744f20b3ed | 5 | CET-4 (B1-B2) | 147 ✅ | 766 ✅ | — | 330 ✅ | 6636 | I need to explain a new project. | Explaining a new project can be challenging. Was it difficult to explain the main idea or the details? |
| 2026-07-10T07:11:23.553Z | 564dc7fe93744f20b3ed | 6 | CET-4 (B1-B2) | 120 ✅ | 749 ✅ | — | 251 ✅ | 4324 | I was nervous because it went well. | That's a great feeling. What was the best part of how it went? |
| 2026-07-10T07:11:33.711Z | 564dc7fe93744f20b3ed | 7 | CET-4 (B1-B2) | 239 ✅ | 772 ✅ | — | 256 ✅ | 4413 | After work, I went to a small restaurant. | That sounds like a nice way to relax. What did you have for dinner? |
| 2026-07-10T07:11:50.531Z | 2cfb474df8ac41bfa0ca | 1 | CET-4 (B1-B2) | — | — | — | — | 5156 |  | Hello, I'm your English speaking coach. Did you have a good breakfast this morning? |
| 2026-07-10T07:11:58.133Z | 2cfb474df8ac41bfa0ca | 2 | CET-4 (B1-B2) | 306 ✅ | 1209 ❌ | — | 235 ✅ | 5638 | My name is Leo, and I had a busy day. | Hi Leo, it sounds like you've had a long day. What was the busiest part of your day? |
| 2026-07-10T07:12:09.800Z | 2cfb474df8ac41bfa0ca | 3 | CET-4 (B1-B2) | 326 ✅ | 670 ✅ | — | 184 ✅ | 6680 | I had three meetings this morning. | Wow, three meetings before lunch is a lot. Did you have any time to relax after them? |
| 2026-07-10T07:12:20.918Z | 2cfb474df8ac41bfa0ca | 4 | CET-4 (B1-B2) | 219 ✅ | 722 ✅ | — | 241 ✅ | 3767 | The second meeting was the most difficult. | I see. What made the second meeting so difficult for you? |
| 2026-07-10T07:12:30.783Z | 2cfb474df8ac41bfa0ca | 5 | CET-4 (B1-B2) | 317 ✅ | 1855 ❌ | — | 269 ✅ | 7121 | I need to explain a new project. | Explaining a new project can be challenging. Did you feel prepared for it, or was it a bit sudden? |
| 2026-07-10T07:12:43.169Z | 2cfb474df8ac41bfa0ca | 6 | CET-4 (B1-B2) | 248 ✅ | 1261 ❌ | — | 214 ✅ | 7013 | I was nervous, but it went well. | That's great to hear. It sounds like you handled the pressure really well. What was the new project about? |
| 2026-07-10T07:12:55.419Z | 2cfb474df8ac41bfa0ca | 7 | CET-4 (B1-B2) | 236 ✅ | 765 ✅ | — | 255 ✅ | 3419 | After work, I went to a small restaurant. | That sounds like a nice way to unwind. What did you have for dinner? |
| 2026-07-10T07:13:04.758Z | 2cfb474df8ac41bfa0ca | 8 | CET-4 (B1-B2) | 138 ✅ | 699 ✅ | — | 252 ✅ | 4985 | I ate beef noodles here. | Beef noodles sound delicious. Did you go there alone or with someone? |
| 2026-07-10T07:13:14.855Z | 2cfb474df8ac41bfa0ca | 9 | CET-4 (B1-B2) | 295 ✅ | 833 ✅ | — | 267 ✅ | 8008 | The noodles were a little spicy. | Oh, spicy food can really wake you up after a long day. Did you enjoy the heat, or was it a bit too much for you? |
| 2026-07-10T07:13:27.999Z | 2cfb474df8ac41bfa0ca | 10 | CET-4 (B1-B2) | 137 ✅ | 824 ✅ | — | 287 ✅ | 4160 | I usually like spicy food. | That's good to know. Do you often look for spicy dishes when you eat out? |
| 2026-07-10T07:13:36.544Z | 2cfb474df8ac41bfa0ca | 11 | CET-4 (B1-B2) | 338 ✅ | 1821 ❌ | — | 265 ✅ | 6326 | My favorite spicy food is hot pot. | Hot pot is a fantastic choice. Do you prefer to cook it at home or go out to a restaurant for it? |
| 2026-07-10T07:13:49.657Z | 2cfb474df8ac41bfa0ca | 12 | CET-4 (B1-B2) | 129 ✅ | 768 ✅ | — | 235 ✅ | 4745 | I often eat hot pot with my sister. | That sounds like a fun tradition. Does she like spicy hot pot as much as you do? |
| 2026-07-10T07:13:59.909Z | 2cfb474df8ac41bfa0ca | 13 | CET-4 (B1-B2) | 114 ✅ | 729 ✅ | — | 226 ✅ | 5070 | Her name is Didi. | That's a lovely name. So, does Lili enjoy spicy hot pot as much as you do? |
| 2026-07-10T07:14:08.922Z | 2cfb474df8ac41bfa0ca | 14 | CET-4 (B1-B2) | 228 ✅ | 815 ✅ | — | 335 ✅ | 5782 | Lily does not like very spicy food. | That's okay. Do you choose a mild spicy base for her, or do you get two different soup bases? |
| 2026-07-10T07:14:19.902Z | 2cfb474df8ac41bfa0ca | 15 | CET-4 (B1-B2) | 264 ✅ | 844 ✅ | — | 271 ✅ | 5454 | We may cook at home this weekend. | That sounds like a fun plan. What ingredients are you thinking of buying for your hot pot? |
| 2026-07-10T07:14:29.899Z | 2cfb474df8ac41bfa0ca | 16 | CET-4 (B1-B2) | 237 ✅ | 834 ✅ | — | 298 ✅ | 7044 | I want to make tomato and egg noodles. | That's a classic and comforting dish. Do you usually make the noodles yourself, or do you buy them from the store? |
| 2026-07-10T07:14:42.626Z | 2cfb474df8ac41bfa0ca | 17 | CET-4 (B1-B2) | 133 ✅ | 748 ✅ | — | 239 ✅ | 7703 | I'm not very good at cooking. | That's okay, tomato and egg noodles are actually quite simple to make. Would you like me to give you some easy tips for  |
| 2026-07-10T07:14:55.561Z | 2cfb474df8ac41bfa0ca | 18 | CET-4 (B1-B2) | 132 ✅ | 859 ✅ | — | 314 ✅ | 4879 | But I enjoy trying new recipes. | That's the best way to learn. What's a new recipe you'd like to try next? |
| 2026-07-10T07:15:07.357Z | 2cfb474df8ac41bfa0ca | 19 | CET-4 (B1-B2) | 221 ✅ | 811 ✅ | — | 354 ✅ | 5109 | What food did I eat after work today? | You mentioned that you had beef noodles at a small restaurant after work today. |
| 2026-07-10T07:15:18.365Z | 2cfb474df8ac41bfa0ca | 20 | CET-4 (B1-B2) | 185 ✅ | 752 ✅ | — | 246 ✅ | 3224 | Who do I often eat hot pot with? | You often eat hot pot with your sister, Lili. |
| 2026-07-10T07:15:27.103Z | 2cfb474df8ac41bfa0ca | 21 | CET-4 (B1-B2) | 206 ✅ | 838 ✅ | — | 356 ✅ | 6121 | Please ask me one final question about my weekend plan. | That sounds like a nice plan. What other dishes are you thinking of making for your weekend meal? |
| 2026-07-10T07:16:42.935Z | d1a13ea9f23140928c25 | 1 | CET-4 (B1-B2) | — | — | — | — | 7699 |  | Hi there, I'm your English speaking coach. Let's chat about your day. What's one thing you're looking forward to doing l |
| 2026-07-10T07:16:51.877Z | d1a13ea9f23140928c25 | 2 | CET-4 (B1-B2) | 328 ✅ | 787 ✅ | — | 224 ✅ | 4104 | My name is Leo, and I had a busy day. | That sounds like a long day. What made it so busy for you? |
| 2026-07-10T07:17:00.080Z | d1a13ea9f23140928c25 | 3 | CET-4 (B1-B2) | 235 ✅ | 832 ✅ | — | 341 ✅ | 6112 | I had three meetings this morning. | Wow, three meetings before lunch is a lot. Did you get a chance to relax at all afterward? |
| 2026-07-10T07:17:11.297Z | d1a13ea9f23140928c25 | 4 | CET-4 (B1-B2) | 213 ✅ | 1271 ❌ | — | 240 ✅ | 3766 | The second meeting was the most difficult. | That sounds tough. What made the second meeting so difficult for you? |
| 2026-07-10T07:17:20.820Z | d1a13ea9f23140928c25 | 5 | CET-4 (B1-B2) | 224 ✅ | 1208 ❌ | — | 172 ✅ | 5639 | I need to explain a new project. | Explaining something new can be tricky. Did your team understand the project clearly in the end? |
| 2026-07-10T07:17:32.173Z | d1a13ea9f23140928c25 | 6 | CET-4 (B1-B2) | 202 ✅ | 772 ✅ | — | 343 ✅ | 6333 | I was nervous, but ah, but it went well. | That's great to hear. It must feel good to know it went well despite your nerves. What was the project about? |
| 2026-07-10T07:17:44.974Z | d1a13ea9f23140928c25 | 7 | CET-4 (B1-B2) | 191 ✅ | 792 ✅ | — | 386 ✅ | 4126 | After work, I went to a small restaurant. | That sounds like a nice way to unwind. What did you have for dinner? |
| 2026-07-10T07:17:54.417Z | d1a13ea9f23140928c25 | 8 | CET-4 (B1-B2) | 193 ✅ | 723 ✅ | — | 237 ✅ | 4081 | I ate beef noodles there. | That sounds delicious. Did the restaurant have a good atmosphere? |
| 2026-07-10T07:18:03.569Z | d1a13ea9f23140928c25 | 9 | CET-4 (B1-B2) | 188 ✅ | 807 ✅ | — | 213 ✅ | 6000 | The noodles were a little spicy. | Spicy food can really wake you up. Did you enjoy the heat, or was it a bit too much? |
| 2026-07-10T07:18:13.479Z | d1a13ea9f23140928c25 | 10 | CET-4 (B1-B2) | 224 ✅ | 853 ✅ | — | 269 ✅ | 4809 | I usually like spicy food. | That's good to know. Was this dish spicier than what you usually eat? |
| 2026-07-10T07:18:23.706Z | d1a13ea9f23140928c25 | 11 | CET-4 (B1-B2) | 142 ✅ | 790 ✅ | — | 311 ✅ | 5438 | My favorite spicy food is hot pot. | Hot pot is a great choice. Do you prefer a very spicy broth or something milder? |
| 2026-07-10T07:18:34.198Z | d1a13ea9f23140928c25 | 12 | CET-4 (B1-B2) | 252 ✅ | 888 ✅ | — | 325 ✅ | 6118 | I often eat hot pot with my sister. | That sounds like a fun tradition. Does your sister enjoy spicy food as much as you do? |
| 2026-07-10T07:18:47.754Z | d1a13ea9f23140928c25 | 13 | CET-4 (B1-B2) | 143 ✅ | 792 ✅ | — | 263 ✅ | 4744 | Her name is Lily. | That's a nice name. Does Lily also love spicy hot pot as much as you do? |
| 2026-07-10T07:18:55.950Z | d1a13ea9f23140928c25 | 14 | CET-4 (B1-B2) | 190 ✅ | 109 ✅ | — | 43 ✅ | 5027 | Lily does not like very spicy food. | That's good to know. Do you choose a milder broth for her, or do you just share the spicy one? |
| 2026-07-10T07:19:06.722Z | d1a13ea9f23140928c25 | 15 | CET-4 (B1-B2) | 142 ✅ | 848 ✅ | — | 322 ✅ | 3476 | We may cook at home this weekend. | That sounds like a fun plan. Will you make hot pot at home? |
| 2026-07-10T07:19:15.618Z | d1a13ea9f23140928c25 | 16 | CET-4 (B1-B2) | 131 ✅ | 825 ✅ | — | 288 ✅ | 6753 | I want to make tomato and egg noodles. | That's a classic and comforting dish. Do you usually add anything else to it, like some green onions or ham? |
| 2026-07-10T07:19:27.681Z | d1a13ea9f23140928c25 | 17 | CET-4 (B1-B2) | 275 ✅ | 1073 ✅ | — | 465 ✅ | 7583 | I'm not very good at cooking. | That's okay, tomato and egg noodles are a perfect dish to practice with. Do you want some easy tips for making it? |
| 2026-07-10T07:19:41.775Z | d1a13ea9f23140928c25 | 18 | CET-4 (B1-B2) | 203 ✅ | 818 ✅ | — | 344 ✅ | 5166 | But I enjoy trying new recipes. | That's the best way to learn. What kind of new recipes do you usually like to try? |
| 2026-07-10T07:19:51.299Z | d1a13ea9f23140928c25 | 19 | CET-4 (B1-B2) | 255 ✅ | 900 ✅ | — | 356 ✅ | 7794 | What food did I eat after work today? | You mentioned having beef noodles at a small restaurant after work today. Did they taste as good as you hoped? |
| 2026-07-10T07:20:03.862Z | d1a13ea9f23140928c25 | 20 | CET-4 (B1-B2) | 267 ✅ | 853 ✅ | — | 289 ✅ | 5654 | Who do I often eat hot pot with? | You often eat hot pot with your sister, Lily. Do you two have a favorite place to go? |
| 2026-07-10T07:20:14.898Z | d1a13ea9f23140928c25 | 21 | CET-4 (B1-B2) | 249 ✅ | 805 ✅ | — | 238 ✅ | 6681 | Please ask me one final question about my weekend plan. | That sounds like a nice plan. Will you cook the tomato and egg noodles just for yourself, or will Lily join you? |
| 2026-07-10T07:21:53.031Z | 2a974a0ff9a34e90b9b4 | 1 | CET-4 (B1-B2) | — | — | — | — | 4838 |  | Hello, I'm your English speaking coach. What's one thing you're looking forward to this week? |
| 2026-07-10T07:22:07.081Z | 2a974a0ff9a34e90b9b4 | 3 | CET-4 (B1-B2) | 8 ✅ | 875 ✅ | — | 273 ✅ | 9950 | Invited me to visit a new art museum near the river, we took the subway there and spent about two hours looking at moder | That sounds like a wonderful day. I'm glad you changed your plan and enjoyed the art and coffee with your friend. Did th |
| 2026-07-10T07:23:14.064Z | 8ee12453693245d0aba5 | 1 | CET-4 (B1-B2) | — | — | — | — | 6711 |  | Hello, I'm your English speaking coach. Let's talk about what you had for breakfast today. What did you eat? |
| 2026-07-10T07:24:20.980Z | c6b29d3940294204866c | 1 | CET-4 (B1-B2) | — | — | — | — | 5783 |  | Hi there, I'm your English speaking coach. What's one thing you're looking forward to this week? |
| 2026-07-10T07:24:29.784Z | c6b29d3940294204866c | 2 | CET-4 (B1-B2) | 197 ✅ | 905 ✅ | — | 288 ✅ | 7714 | Last Saturday, I planned to stay at home, but my college friend called me in the morning. She invited me to visit a new  | That sounds like a wonderful surprise. It's great that you ended up enjoying the change of plans. What was the name of t |
| 2026-07-10T07:25:59.131Z | 28a11849290f4a828f73 | 1 | CET-4 (B1-B2) | — | — | — | — | 6424 |  | Hi there, I'm your English speaking coach. Let's get started. What did you have for breakfast this morning? |
| 2026-07-10T07:26:08.050Z | 28a11849290f4a828f73 | 2 | CET-4 (B1-B2) | 186 ✅ | — | — | 156 ✅ | 707 | Last. | Last what? Do you mean last week, or your last vacation? |
| 2026-07-10T07:26:15.293Z | 6d91951ab7fe4fa3abcd | 1 | CET-4 (B1-B2) | — | — | — | — | 4810 |  | Hello, I'm your English speaking coach. Did you have a good breakfast this morning? |
| 2026-07-10T07:26:21.663Z | 6d91951ab7fe4fa3abcd | 2 | CET-4 (B1-B2) | 291 ✅ | 826 ✅ | — | 17 ✅ | 4461 | Last Saturday, I planned to stay at home, but my college friend called me in the morning. She invited me to visit a new  | That sounds like a wonderful surprise. Which painting reminded you of the ocean? |
| 2026-07-10T07:27:18.507Z | 42d9b7db5e7443ffaf79 | 1 | CET-4 (B1-B2) | — | — | — | — | 7961 |  | Hi there, I'm your English speaking coach. Let's chat about your day. What was the most interesting thing you did this m |
| 2026-07-10T07:30:56.020Z | 5133964edb11431983b2 | 1 | CET-4 (B1-B2) | — | — | — | — | 6816 |  | Hello, I’m your English speaking coach. Let’s start with something simple. What did you have for breakfast this morning? |
| 2026-07-10T07:31:05.604Z | 5133964edb11431983b2 | 2 | CET-4 (B1-B2) | 215 ✅ | 698 ✅ | — | 155 ✅ | 4726 | I went to walk. It it very busy today. So I had, three meetings in the morning. | That sounds like a very busy morning. How are you feeling now that the meetings are over? |
| 2026-07-10T07:31:20.966Z | 5133964edb11431983b2 | 3 | CET-4 (B1-B2) | 203 ✅ | 691 ✅ | — | 170 ✅ | 5293 | Uh, I feel good now because I, even though I'm very I was very nervous before the meeting, but it went well. | That's great to hear. It feels so good when a stressful meeting goes well, doesn't it? |
| 2026-07-10T07:31:39.365Z | 5133964edb11431983b2 | 4 | CET-4 (B1-B2) | 215 ✅ | 713 ✅ | — | 173 ✅ | 5655 | Yes, of course. | I'm glad it worked out for you. What was the most important thing you discussed in those meetings? |
| 2026-07-10T07:31:48.088Z | 5133964edb11431983b2 | 5 | CET-4 (B1-B2) | 200 ✅ | 781 ✅ | — | 272 ✅ | 4718 | I don't want to talk about these things. I think we can change the topic. I want to talk about something about my lunch. | Of course, let's talk about lunch. What are you thinking of eating? |
| 2026-07-10T07:32:02.168Z | 5133964edb11431983b2 | 6 | CET-4 (B1-B2) | 235 ✅ | 769 ✅ | — | 233 ✅ | 4754 | Uh, I prefer to having a noodle maybe. | That sounds like a good choice. Do you prefer rice noodles or wheat noodles? |
| 2026-07-10T07:32:13.208Z | 5133964edb11431983b2 | 7 | CET-4 (B1-B2) | 119 ✅ | 796 ✅ | — | 346 ✅ | 7020 | Of course, rice noodles. | Rice noodles are a great choice. Do you have a favorite way to eat them, like in a soup or stir-fried? |
| 2026-07-10T07:32:30.397Z | 5133964edb11431983b2 | 9 | CET-4 (B1-B2) | 88 ✅ | 912 ✅ | — | 294 ✅ | 6534 | Two are very delicious. | I agree, they are both delicious. Do you prefer a spicy soup or a mild one? |
| 2026-07-10T07:32:41.387Z | 5133964edb11431983b2 | 10 | CET-4 (B1-B2) | 199 ✅ | 879 ✅ | — | 334 ✅ | 4896 | Spicy soup. Spicy is my favorite. And after the lunch, I think I will go to the cinema to watch a movie. | That sounds like a perfect plan. What kind of movie are you thinking about watching? |
| 2026-07-10T07:32:57.289Z | 5133964edb11431983b2 | 11 | CET-4 (B1-B2) | 202 ✅ | 812 ✅ | — | 290 ✅ | 8969 | Maybe a cartoon movie. | Cartoon movies are great for relaxing. Do you have a favorite one in mind, or will you just pick something that looks go |
| 2026-07-10T07:33:10.747Z | 5133964edb11431983b2 | 12 | CET-4 (B1-B2) | 184 ✅ | 863 ✅ | — | 325 ✅ | 4582 | I just go to the cinema and pick a, a good one maybe, and I think I will go to the cinema in the weekend. | That's a good plan. Do you usually go to the cinema on weekends? |
| 2026-07-10T07:33:29.533Z | 5133964edb11431983b2 | 13 | CET-4 (B1-B2) | 228 ✅ | 1958 ❌ | — | 416 ✅ | 5429 | Yeah, because I'm, alone in, Shanghai for working, so I don't have much friends. So I usually go to the cinema on weeken | I understand. It's a great way to relax by yourself. What was the last movie you saw alone? |
| 2026-07-10T07:33:47.818Z | 5133964edb11431983b2 | 14 | CET-4 (B1-B2) | 690 ❌ | 866 ✅ | 807 ❌ | 313 ✅ | 4196 |  | Take your time. What was the last movie you saw alone? |
| 2026-07-10T07:33:55.323Z | 5133964edb11431983b2 | 15 | CET-4 (B1-B2) | 181 ✅ | 1492 ❌ | — | 338 ✅ | 5498 | I think when I finish this job, I will go for traveling. | That sounds like a wonderful plan to look forward to. Where would you like to travel? |
| 2026-07-10T07:34:10.633Z | 5133964edb11431983b2 | 16 | CET-4 (B1-B2) | 141 ✅ | 1483 ❌ | — | 335 ✅ | 9722 | Maybe Chongqing. Do you know that city? A very fantastic city. | Yes, I know Chongqing. It's famous for its spicy hot pot and unique mountain city landscape. What are you most excited t |
| 2026-07-10T07:34:37.542Z | 5133964edb11431983b2 | 18 | CET-4 (B1-B2) | 151 ✅ | 1471 ❌ | — | 348 ✅ | 6846 | 因重庆。 | Yes, Chongqing is famous for its many bridges. Which bridge are you most excited to see? |
| 2026-07-10T07:34:48.093Z | 5133964edb11431983b2 | 19 | CET-4 (B1-B2) | 191 ✅ | 1463 ❌ | — | 348 ✅ | 6450 | I don't know. Maybe you can recommend. | You could visit the Qiansimen Bridge, it has a very unique design. Does that sound interesting to you? |
| 2026-07-10T07:34:59.050Z | 5133964edb11431983b2 | 20 | CET-4 (B1-B2) | 243 ✅ | 1424 ❌ | — | 354 ✅ | 27875 | Yes. Yes. So now give me a detailed score from one to ten and write a long report about my English. | I can certainly give you some feedback on your English. I'd say you're doing well at communicating your ideas clearly, w |
| 2026-07-10T07:35:36.735Z | 5133964edb11431983b2 | 21 | CET-4 (B1-B2) | 218 ✅ | 1167 ✅ | — | 602 ✅ | 3830 | Okay, then ask me one simple question about travel. | What is one thing you always pack in your bag when you travel? |
| 2026-07-10T07:36:55.306Z | 9f3839ad1bc84b8b844f | 1 | CET-4 (B1-B2) | — | — | — | — | 2543 |  | Hello, I'm your English speaking coach. Did you have a good breakfast this morning? |
| 2026-07-10T07:36:57.852Z | 9f3839ad1bc84b8b844f | 2 | CET-4 (B1-B2) | 83 ✅ | 720 ✅ | — | 224 ✅ | 3424 | My name is Leo. | Nice to meet you, Leo. What kind of work do you do? |
| 2026-07-10T07:37:04.064Z | 9f3839ad1bc84b8b844f | 3 | CET-4 (B1-B2) | 120 ✅ | 1012 ✅ | — | 410 ✅ | 5928 | I live in Suzhou. | That's a beautiful city with its gardens and canals. What do you enjoy most about living in Suzhou? |
| 2026-07-10T07:37:13.313Z | 9f3839ad1bc84b8b844f | 4 | CET-4 (B1-B2) | 243 ✅ | 782 ✅ | — | 300 ✅ | 6981 | I work in a bank. | That's interesting. A natural way to say that is, "I work in a bank." What do you enjoy most about your job? |
| 2026-07-10T07:37:24.834Z | 9f3839ad1bc84b8b844f | 5 | CET-4 (B1-B2) | 204 ✅ | 799 ✅ | — | 261 ✅ | 4420 | My favorite sport is basketball. | That's great. Do you play often, or do you mostly enjoy watching the games? |
| 2026-07-10T07:37:33.428Z | 9f3839ad1bc84b8b844f | 6 | CET-4 (B1-B2) | 109 ✅ | 825 ✅ | — | 249 ✅ | 4455 | My sister's name is Lily. | That's a nice name. Does Lily also enjoy playing basketball? |
| 2026-07-10T07:37:41.636Z | 9f3839ad1bc84b8b844f | 7 | CET-4 (B1-B2) | 181 ✅ | 808 ✅ | — | 256 ✅ | 4644 | I will travel to Qingdao next month. | That sounds like a wonderful trip. Are you planning to visit the beach while you are there? |
| 2026-07-10T07:37:51.335Z | 9f3839ad1bc84b8b844f | 8 | CET-4 (B1-B2) | 124 ✅ | 852 ✅ | — | 308 ✅ | 4509 | Oh, let's talk about the, ah, lunch. Okay. | Sure, let's talk about lunch. What did you have for lunch today? |
| 2026-07-10T07:38:01.639Z | 9f3839ad1bc84b8b844f | 9 | CET-4 (B1-B2) | 147 ✅ | 879 ✅ | — | 336 ✅ | 6746 | I had noodle, beef noodle. | That sounds delicious. Do you often have beef noodles for lunch, or was it a special choice today? |
| 2026-07-10T07:38:20.154Z | 9f3839ad1bc84b8b844f | 11 | CET-4 (B1-B2) | 4 ✅ | 861 ✅ | — | 301 ✅ | 8974 | Beef. | That makes sense. A natural way to say that is, "I'm a very big fan of beef." Do you prefer your noodles with soup or dr |
| 2026-07-10T07:38:31.797Z | 9f3839ad1bc84b8b844f | 12 | CET-4 (B1-B2) | 235 ✅ | 826 ✅ | — | 332 ✅ | 8309 | In soup. | Me too. A hot bowl of soup is perfect for lunch. Do you like to add any chili oil or vinegar to your noodles? |
| 2026-07-10T07:38:43.555Z | 9f3839ad1bc84b8b844f | 13 | CET-4 (B1-B2) | 256 ✅ | 743 ✅ | — | 254 ✅ | 5023 | I don't want to talk about the topic about lunch. So let's, now I have a question: What is Malay? | Your name is Leo. Would you like to talk about your upcoming trip to Qingdao instead? |
| 2026-07-10T07:38:59.076Z | 9f3839ad1bc84b8b844f | 14 | CET-4 (B1-B2) | 238 ✅ | 853 ✅ | — | 279 ✅ | 5233 | Where do I live? | You live in Suzhou. Are you thinking about the weather there compared to Qingdao? |
| 2026-07-10T07:39:08.341Z | 9f3839ad1bc84b8b844f | 15 | CET-4 (B1-B2) | 83 ✅ | 809 ✅ | — | 300 ✅ | 3502 | Where do I work? | You work in a bank. Do you enjoy your job there? |
| 2026-07-10T07:39:14.760Z | 9f3839ad1bc84b8b844f | 16 | CET-4 (B1-B2) | 126 ✅ | 793 ✅ | — | 306 ✅ | 6051 | What sport do I like? | Your favorite sport is basketball. Do you play often, or do you mostly enjoy watching the games? |
| 2026-07-10T07:39:24.136Z | 9f3839ad1bc84b8b844f | 17 | CET-4 (B1-B2) | 260 ✅ | 843 ✅ | — | 305 ✅ | 4624 | What's my sister's name? | Your sister's name is Lily. Does she also enjoy playing basketball? |
| 2026-07-10T07:39:32.472Z | 9f3839ad1bc84b8b844f | 18 | CET-4 (B1-B2) | 178 ✅ | 823 ✅ | — | 237 ✅ | 4220 | What's my sister's name? | Your sister's name is Lily. Does she also enjoy playing basketball? |
| 2026-07-10T07:39:41.016Z | 9f3839ad1bc84b8b844f | 19 | CET-4 (B1-B2) | 104 ✅ | 750 ✅ | — | 248 ✅ | 4391 | Where will I travel next month? | You will travel to Qingdao next month. Are you excited about the trip? |
| 2026-07-10T07:40:08.179Z | 52111432efbc413f93a5 | 1 | CET-4 (B1-B2) | — | — | — | — | 1823 |  | Hi, I'm your English speaking coach. Let's chat about your morning routine. What is the first thing you usually do after |
| 2026-07-10T07:40:19.281Z | d8fc6f975c534e24b7db | 1 | CET-4 (B1-B2) | — | — | — | — | 1814 |  | Hi there, I'm your English speaking coach. What's one thing you're looking forward to this week? |
| 2026-07-10T07:40:21.107Z | d8fc6f975c534e24b7db | 2 | CET-4 (B1-B2) | 112 ✅ | 189 ✅ | 48 ✅ | 9 ✅ | 2219 | My name is Leo. | Hello, I'm your English speaking coach. To get us started, what's one thing you're looking forward to this week? |
| 2026-07-10T07:40:31.266Z | dd89462a81a94e1a8fa0 | 1 | CET-4 (B1-B2) | — | — | — | — | 2106 |  | Hi there, I'm your English speaking coach. Let's get started. What did you have for breakfast this morning? |
| 2026-07-10T07:40:41.688Z | 0fb364befd354b89a80d | 1 | CET-4 (B1-B2) | — | — | — | — | 5842 |  | Hello, I'm your English speaking coach. What's one thing you're looking forward to this week? |
| 2026-07-10T07:40:50.677Z | 0fb364befd354b89a80d | 2 | CET-4 (B1-B2) | 434 ✅ | 328 ✅ | — | 3 ✅ | 3333 | My name is Leo. | Nice to meet you, Leo. What did you have for breakfast this morning? |
| 2026-07-10T07:40:57.404Z | 0fb364befd354b89a80d | 3 | CET-4 (B1-B2) | 90 ✅ | 794 ✅ | — | 304 ✅ | 5779 | I live in Suzhou. | That's great. Suzhou is famous for its beautiful gardens. Which one is your favorite? |
| 2026-07-10T07:41:06.317Z | 0fb364befd354b89a80d | 4 | CET-4 (B1-B2) | 107 ✅ | 749 ✅ | — | 318 ✅ | 4715 | I work in bank. | That sounds like a busy job. What do you enjoy most about working in a bank? |
| 2026-07-10T07:41:13.955Z | 0fb364befd354b89a80d | 5 | CET-4 (B1-B2) | 235 ✅ | 779 ✅ | — | 197 ✅ | 5020 | My favorite sport is basketball. | That's a fun sport. Do you play often, or do you prefer watching the games? |
| 2026-07-10T07:41:22.767Z | 0fb364befd354b89a80d | 6 | CET-4 (B1-B2) | 138 ✅ | 1271 ❌ | — | 1151 ❌ | 6390 | My sister's name is Lily. | That's a lovely name. Does Lily also enjoy playing basketball, or does she have different hobbies? |
| 2026-07-10T07:41:32.937Z | 0fb364befd354b89a80d | 7 | CET-4 (B1-B2) | 318 ✅ | 753 ✅ | — | 202 ✅ | 4397 | I will travel to Qingdao next month. | That sounds exciting. Are you going there for a vacation or for work? |
| 2026-07-10T07:41:44.607Z | 0fb364befd354b89a80d | 8 | CET-4 (B1-B2) | 140 ✅ | 843 ✅ | — | 348 ✅ | 6015 | Okay, so now I want to talk about something about the World Cup. | Sure, the World Cup is always thrilling. Which team are you supporting this year? |
| 2026-07-10T07:41:59.076Z | 0fb364befd354b89a80d | 9 | CET-4 (B1-B2) | 232 ✅ | — | — | 252 ✅ | 414 | 呃。 | Take |
| 2026-07-10T07:42:00.770Z | 0fb364befd354b89a80d | 10 | CET-4 (B1-B2) | 273 ✅ | 998 ✅ | — | 477 ✅ | 4865 | France and Protagon. | Those are two strong teams. Which player are you most excited to see? |
| 2026-07-10T07:42:10.477Z | 0fb364befd354b89a80d | 11 | CET-4 (B1-B2) | 196 ✅ | 936 ✅ | — | 364 ✅ | 6201 | 嗯，八陪。 | He is an amazing player with incredible speed. What do you think makes him so special on the field? |
| 2026-07-10T07:42:21.027Z | 0fb364befd354b89a80d | 12 | CET-4 (B1-B2) | 121 ✅ | 805 ✅ | — | 329 ✅ | 6372 | Uh, I think he is very good on shooting. | That's true, his shooting is very powerful. Do you think his speed is also a big advantage for him? |
| 2026-07-10T07:42:32.499Z | 0fb364befd354b89a80d | 13 | CET-4 (B1-B2) | 188 ✅ | 757 ✅ | — | 208 ✅ | 7575 | Yes, of course. That's why he was regarded as the best player in the world. | I agree, his combination of speed and skill is incredible. Do you think he will win the World Cup this time? |
| 2026-07-10T07:42:47.261Z | 0fb364befd354b89a80d | 14 | CET-4 (B1-B2) | 267 ✅ | 764 ✅ | — | 271 ✅ | 5049 | Of course, so what's what is my name? | Your name is Leo. Do you think France has a good chance of winning with him on the team? |
| 2026-07-10T07:42:57.675Z | 0fb364befd354b89a80d | 15 | CET-4 (B1-B2) | 102 ✅ | 811 ✅ | — | 361 ✅ | 3508 | Where do I live? | You live in Suzhou. Is it a good city for playing basketball? |
| 2026-07-10T07:43:04.520Z | 0fb364befd354b89a80d | 16 | CET-4 (B1-B2) | 302 ✅ | 856 ✅ | — | 274 ✅ | 3864 | Where do I walk? | You work in a bank. Do you find it stressful sometimes? |
| 2026-07-10T07:43:12.522Z | 0fb364befd354b89a80d | 17 | CET-4 (B1-B2) | 211 ✅ | 818 ✅ | — | 340 ✅ | 5439 | What sport do I like? | Your favorite sport is basketball. Do you have a favorite team you like to watch? |
| 2026-07-10T07:43:21.083Z | 0fb364befd354b89a80d | 18 | CET-4 (B1-B2) | 197 ✅ | 1398 ❌ | — | 410 ✅ | 5784 | What is my sister's name? | Your sister's name is Lily. Does she also like watching basketball games with you? |

## Session continuity

The continuity result is considered passing when duration is 3–10 minutes, there are no connection disruptions, packet loss is at most 3%, maximum jitter is at most 100 ms, and average RTT is at most 500 ms.

| Time | Conversation | Duration min | Packets lost | Loss % | Max jitter ms | Avg RTT ms | Disruptions | Result |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 2026-07-10T06:57:56.695Z | 024df5a1a37941ab8ddf | 0.20 | 0 | 0.00 | 0 | 113 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T06:58:13.628Z | 024df5a1a37941ab8ddf | 0.26 | 0 | 0.00 | 30 | 52 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T06:58:50.095Z | 024df5a1a37941ab8ddf | 0.48 | 0 | 0.00 | 14 | 22 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:00:06.562Z | 024df5a1a37941ab8ddf | 1.25 | 0 | 0.00 | 10 | 49 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:00:45.878Z | 024df5a1a37941ab8ddf | 0.11 | 0 | 0.00 | 7 | 16 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:01:41.944Z | 024df5a1a37941ab8ddf | 0.28 | 0 | 0.00 | 108 | 22 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:02:10.510Z | 024df5a1a37941ab8ddf | 0.20 | 0 | 0.00 | 15 | 19 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:02:29.194Z | 024df5a1a37941ab8ddf | 0.29 | 0 | 0.00 | 9 | 46 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:02:48.044Z | 024df5a1a37941ab8ddf | 0.28 | 0 | 0.00 | 9 | 36 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:05:45.176Z | 024df5a1a37941ab8ddf | 0.35 | 0 | 0.00 | 45 | 33 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:06:21.775Z | 024df5a1a37941ab8ddf | 0.29 | 4 | 0.74 | 13 | 20 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:06:47.375Z | 024df5a1a37941ab8ddf | 0.31 | 0 | 0.00 | 73 | 27 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:07:16.541Z | 024df5a1a37941ab8ddf | 0.37 | 0 | 0.00 | 16 | 31 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:08:00.442Z | 024df5a1a37941ab8ddf | 0.31 | 0 | 0.00 | 8 | 20 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:08:34.424Z | 024df5a1a37941ab8ddf | 0.36 | 5 | 1.00 | 215 | 22 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:09:02.425Z | 024df5a1a37941ab8ddf | 0.39 | 2 | 0.40 | 20 | 31 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:09:27.355Z | 7bb1d826c0ea475abe95 | 0.37 | 0 | 0.00 | 15 | 27 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:09:51.005Z | 0c306b9aeba541838e8f | 0.32 | 0 | 0.00 | 350 | 31 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:11:43.471Z | 564dc7fe93744f20b3ed | 1.20 | 0 | 0.00 | 19 | 43 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:15:40.001Z | 2cfb474df8ac41bfa0ca | 3.85 | 23 | 0.42 | 296 | 62 | 0 | ❌ Review |
| 2026-07-10T07:20:26.865Z | d1a13ea9f23140928c25 | 3.76 | 21 | 0.38 | 370 | 81 | 0 | ❌ Review |
| 2026-07-10T07:22:51.564Z | 2a974a0ff9a34e90b9b4 | 1.00 | 0 | 0.00 | 16 | 25 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:24:06.347Z | 8ee12453693245d0aba5 | 0.90 | 0 | 0.00 | 14 | 30 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:25:16.361Z | c6b29d3940294204866c | 0.95 | 2 | 0.31 | 15 | 34 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:26:12.429Z | 28a11849290f4a828f73 | 0.24 | 3 | 0.79 | 37 | 35 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:27:03.028Z | 6d91951ab7fe4fa3abcd | 0.82 | 0 | 0.00 | 13 | 25 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:28:07.178Z | 42d9b7db5e7443ffaf79 | 0.83 | 0 | 0.00 | 12 | 32 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:35:45.674Z | 5133964edb11431983b2 | 4.85 | 4 | 0.06 | 22 | 30 | 0 | ✅ Pass |
| 2026-07-10T07:39:50.356Z | 9f3839ad1bc84b8b844f | 2.94 | 8 | 0.18 | 70 | 25 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:40:16.106Z | 52111432efbc413f93a5 | 0.16 | 3 | 1.02 | 11 | 46 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:40:27.923Z | d8fc6f975c534e24b7db | 0.17 | 0 | 0.00 | 71 | 40 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:40:37.221Z | dd89462a81a94e1a8fa0 | 0.12 | 0 | 0.00 | 12 | 20 | 0 | ⏳ Need 3–10 min |
| 2026-07-10T07:43:36.122Z | 0fb364befd354b89a80d | 2.93 | 7 | 0.16 | 187 | 45 | 0 | ⏳ Need 3–10 min |
