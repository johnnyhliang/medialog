# The Ultimate USACO Practice Method

So long now, but this will be worth your time if you have any interest in USACO. Has all my general advice so I never type again. Version without USACO specifics on codeforces: [https://codeforces.com/blog/entry/116371](https://codeforces.com/blog/entry/116371). CF version is now more up to data on any section it has.

# Introduction

This is a post on how I believe is the best method to practice modern day USACO (plus some thinking approach help and advice I added at the end so I can send everything in one article).

Pretty bold claim in the title I guess. However, I have been in the USACO game for a few years now, and I have tried many practice methods (guess who completed all of the *****_mostly_ useless training gate :clown: **Read footnote if you are complete beginner however.**) along with having observed many people who practiced different styles and improved at different rates, and I think I have seen a consistent trend in what has helped others and myself improve best.

First, a quick tl;dr from a comment where I said I'd post this multiple days ago (oops):

> **In short, you only need to use codeforces, find a rating range where you can solve around ~30-40% of the time on your own, and just grind down the problem set tab in reverse order of id (the default sorting). Also take part in every live contest you can, and virtual any live contests you miss.**
> 
> **ADDITION: Approximately once per week (probably on each weekend), I recommend you virtual an OI contest then upsolve the ones you understand the editorial for after. This should be old usaco contests until you finish all in the past 5 or so years, then use OI checklist to find new contests. Make sure you go for subtasks just as you would in real contests when doing so.**

Some parts of this method may seem strange to you, so I'll explain in more detail and comment on why I believe it is the best method, and give some proof. If you're too lazy to read all of it, **the most important parts of this article are bolded**. Also, **I am assuming you are able to practice somewhat regularly (at least a few problems done each week for multiple months), and this practice is unlikely to work if you don't. If you are aiming for camp, ideally practice should be daily, no breaks.**

# Goal of Practice

First off, what is the main goal in practicing efficiently? I would argue **you want to come across as many subtle ideas and concepts as quickly as possible and learn to intuitively realize when to apply them.** This is what my practice method is centered around.

**Addition: However, you should also feel discomfort in effort of trying to think new ideas as much as possible, but don't mistake this as time being confused with discomfort having no idea what to do.** Actively making new insights as fast as possible is the state you should be in a lot during live contests and need to endure actively thinking new ideas while trying to not repeat same ideas in your mind. But when you have no clue how to approach/understand a solution to a problem, you are more likely to lose focus and are not helping yourself, so you want to minimize this.

# Why Codeforces?

So, why only codeforces? Well, recent codeforces problems do a decently good job of introducing a large variety of concepts, particularly in the 2000+ rating range. Thanks to the large standards of wanting non-standard problems each contests, many small math tricks and greedy techniques are introduced, along with standard algorithms and data structure appearing decently enough. This is why I think they are the best collection of problems. Similarly, **USACO in the recent years is becoming more dependent on skill in greedy combinatorial skills like monovariants and invariants, and codeforces does a very good job in teaching you these things.** In contrast, older USACO problems are not as diverse in topics and do not accurately reflect the diversity and ad-hoc thinking in recent contests. **Recent codeforces contests are by far better than old contests however, so that is why you should grind down the problems from most to least recent in the problem set tab.** If you have done all contests later than contest 450, you should probably start using another judge and be primarily doing virtual contests instead, but you probably don't need this guide if that was the case :stuck_out_tongue:.

# How to Approach Problems in Practice

Alright, so codeforces seems good. Why only a rating range where you can solve ~30-40% of the time? Shouldn't you be practicing coming up with solutions on your own? Well, like I said earlier, you want to come across as many concepts as quickly as possible. If you're able to solve ~80%+ of the problems you're doing on your own, even if it takes a while, or in fact especially if it takes a while, you are not using your time most effectively, as you were already able to come up with the concept on your own. **It is OK to read editorials often**, that is where you actually learn new things. **Binary search on the problem set tab to find a rating range of problems that fits the ~30-40% specification, and I recommend the rating range to a few hundred points wide.**

Well, the next natural question is how long should you take before reading editorials? I will argue **only spend 15m thinking, after that if you're still having ideas keep thinking, but if you're just stuck read the editorial. However, if reading the editorial gives you new ideas continue thinking again.** Sure, you may discover a trick you came up with yourself you can use later after a long time thinking, but was it worth spending 3h coming up with the solution on your own when you could've gone through 2 or 3 more problems if you read the editorial instead. However, going through too hard problems is just as bad is going through too easy problems. It is not worth spending 4h understanding a 3000 rated problem when you could learn much more concepts from 4 2300 rated problems in the same amount of time (if that's good for your skill level). That's why I say ~30-40%, this is usually the point where you can understand the editorial relatively quickly but aren't able to see the concepts on your own. Also, **this is another reason to use codeforces instead of other sources, the problems are shorter so you can get through more faster and it is easier to find many problems of similar skill leve**l.

Some important notes, however, are to **take the 15m of thinking very seriously and implement every problem**. _**This is extremely important!!!**_ **you should only be looking at editorial when you are really out of ideas and trying to think longer will just make you unfocused or reiterate old ideas.** It is important to practice making observations on your own, and you should be solving problems in the range more and more often as you go down the problem list, that's how you know you're improving. You may think you can get through more concepts earlier without implement too, and this would fit the main goal of practice better, however, it's important to always implement every problem that isn't completely trivial, even if you mind solve it on your own, as you will remember it better and often you will realize you didn't understand the details as well as you thought before implementing.

**ADDITION: I also recommend timing yourself when doing problems, at least while implementing.** This will help you stay focused and improve your implement speed (which is important so you don't waste time implementing in contest). If you record your times you should hopefully see yourself getting faster for a fixed problem difficulty :).

Also, it can be good to look at others solutions after you finish a problem quickly to see if there are any implementation tricks you don't know.

# When to Learn Algorithms/Data structures

Next thing to come up is when in this am I supposed to learn new standard algorithms and data structures? I advise **when you come across an algorithm or any other concept (maybe math idea) in an editorial you don't know about to immediately find and read an article about it, implement in the context of this problem, and then continue just moving down the problem set tab.** You can usually find an article on USACO guide, cp-algorithms, or a codeforces blog. The idea behind this is that algorithms should come up at a rate according to their relevance, so if the algorithm really is important you should see it in more problems soon, and you don't need to go looking for more problems with the topic. Similarly, it is important to see algorithms in context, which is why **you should not practice by topic**, as you will likely miss out on many more subtle techniques and tricks not in a topics list and get too used to knowing the algorithm used ahead time when you should be trying to figure that out in the 15m thinking time.

However, if you want a break or have some time at school when you can't do problems, reading through random algorithm articles in the locations listed above is a good way to expose you to some new ideas. But it is still more important to be actively solving problems when you can.

# Live Contests

The number one thing that probably looks wrong with this practice method, despite the reasonings I gave earlier, is that you seem like you are not practicing solving problems on your own often enough. This is where live contests come in. **It is important to take part in as many live contests as possible from** _**every**_ **judge you can (except ones where every problem feels too easy)**. This is where you practice thinking on your own, and if you look enough there are tons of contests all the time, particularly high quality ones from atcoder and codeforces. **You should also upsolve the hardest problem you didn't solve during the contest,** however, after that you should just go back to the codeforces problem set grind unless there are more problems from the contest within your practice rating range on codeforces. Lastly, to make sure you're taking enough contest, **take every codeforces contest you miss that would be rated for you as a virtual contest.**

**ADDITION: Added that you should do OI virtual about once per week as subtasks are becoming more important in USACO plus probably good to have more extended focus practice anyway.** You also want to shift practice to doing mostly OI virtuals the week before a USACO contest begins. Make sure for these virtuals you are going for maximum points like in a real contest which may mean implementing subtasks, not just implementing full solves. If you aren't practicing a ton or you feel virtuals are taking too much time away from doing codeforces practice maybe do every other week instead of every week.

# USACO Guide?

One other thing about this practice method that may seem to contradict a lot of recent advice is not using USACO guide. This is mostly because of the stated earlier reason of why practicing by topic is bad, and USACO guide is largely organized by topic. However, **I think it is very good to look over your division and the one above it on USACO guide the week before each of the USACO monthly contests and read about and solve a problem for any topic you haven't seen yet.** If you have been practicing regularly, you should have came across nearly all of these topics, however it is always possible you somehow never came across one, and if it is put on USACO guide in your division it is likely to come up in contest. It's also just good to have a review/refresher right before USACO. Similarly, if you have not been practicing regularly or just started, USACO guide might be your best chance at a life saver before a contest.

# Scheduling Practice

This is less important but more just some pointers on scheduling time to practice consistently. I think it is obviously best to practice daily, and it isn't as hard as you may think it is if you build up good habits. **I think it is good to have a regularly scheduled time where you can practice each day**, as this makes it more of a consistent habit. Similarly, **if you can set aside a specific location to practice as well that would be good**, as this can give your mindset the habit that a specific time and place is for practicing only, and you build focus**.** **Try to practice at least 90m for your scheduled time**, but preferably longer. And _**get off discord!!!**_ when you're practicing in the designated time :clown:.

Besides scheduled practice time, you can probably fit in more practice time in some or many days in different ways as well if you are serious. For example, **I think it is good to memorize some problems at the beginning of each day, maybe a bit harder than you'd normally practice, and think about them all day** during school, shower, eating, etc., or maybe the same problems for a few days. This helps you practice thinking more on your own. Also, when you have free time in class or while in car and someone else is driving or something, this is a good time to read algorithm articles. When I went to public school I also bought a portable keyboard to practice in class and spent most school lunch days in the library doing problems, but this might be overkill. **Point is find all times of day to practice any way possible when you can, but most import is the scheduled practice time.**

# Proof/Basis of Method

**This practice method is largely based off of watching and talking to** [fivefourthreeone](https://codeforces.com/profile/fivefourthreeone). I remember being both amazed and jealous seeing him reach international master in just three months from no prior training. Of course, not everyone will be able to do that, he is also insanely talented, but his practicing was very similar to this and emphasized learning many topics in a short amount of time.

Some other examples of people who rely off of mostly only codeforces and live contests are [timmyfeng](https://codeforces.com/profile/timmyfeng) and [geothermal](https://codeforces.com/profile/geothermal). Both of the users are obviously very successful and show you only need codeforces to do good. Timmyfeng practices a bit different than this however, where he virtuals every contest before upsolving them. Obviously this works with great success for him and helps practicing thinking on your own more, but I believe you are wasting a lot of time on easier problems if you do this.

Lastly, if you're not convinced with the editorial spamming thing and think you are not solving on your own enough, even the great [benq](https://codeforces.com/profile/benq) has stated he primarily solves in an editorial spam method along with participating and upsolving in many live contests. He apparently even reads editorials before the problem statement when he's lazy lol (I don't recommend this though).

Also, **I don't know a single high rated competitor that recommends to practice by topic.** I believe this is a mindset that comes from the school mentality, but it is not good for olympiad where the problem could come from a vary wide range of topics and you need to figure out which on your own.

# Outro

Hopefully this was somewhat useful to some of you, and gives you a comprehensive guide on how to practice for USACO and competitive programming in general. **Please share this with others if you think it is useful** :smile:**.**

For any more experienced people, let me know if there is anything you strongly disagree with that I said, I'd be interested to hear your viewpoint, though you're unlikely to change my mind :wink:.

# Footnotes

*****I actually recommend the beginning of the usaco training page to _complete beginners_. I think it is a good way to start out as it guides you on the basics, and you should be able to start as soon as you know the very basics to a programming language, preferably c++ (you can use codeacademy to learn basics, it should take only a couple days max. you learn other parts about the language as you solve more problems and googling as needed). However, as soon as you finish chapter one or the problems feel easy (or if codeforces is still too intimidating maybe hard max finish chapter 2), that is when I recommend you start using this practice method, and perhaps also try some problems from the cses sorting and searching section. I assume most people on this subreddit at least have a little bit of experience anyway.

Sources mentioned:  
USACO - [http://www.usaco.org](http://www.usaco.org)  
Codeforces - [https://codeforces.com](https://codeforces.com)  
Atcoder - [https://atcoder.jp](https://atcoder.jp)  
CSES - [https://cses.fi/problemset/](https://cses.fi/problemset/)  
Training gate - [https://train.usaco.org](https://train.usaco.org)  
OI Checklist - [https://oichecklist.pythonanywhere.com](https://oichecklist.pythonanywhere.com)  
Cp-Algorithms - [https://cp-algorithms.com](https://cp-algorithms.com)  
USACO Guide - [https://usaco.guide](https://usaco.guide)  
Codeacademy - [https://www.codecademy.com/catalog/language/c-plus-plus](https://www.codecademy.com/catalog/language/c-plus-plus)

---

# Extra Advice How to Think to Solve Problems

**Overall, just make sure you are always thinking new ideas and repeatedly combining old observations to make new ones.** But for some more direct tips, try going through the following checklist when approaching a problem:

1. look at everything from perspective of binary and graph
    
2. think how information you have can be reused (like dp but more general)
    
3. reduce things to as simple as possible, get rid of redundant transitions/states/etc., resolve same and induct
    
4. make formulas out of everything, expand/rewrite as many ways possible
    
5. visualize everything, draw things out
    
6. look for structures like montonicity, concavity, etc., and do this for every part of problem, whether specific part or entire structure of solution
    
7. go through testcases by hand, maybe also make generator/brute force checker if stuck to further look for patterns
    
8. don't think same things over and over, write down everything you think and try to always write down new ideas, every small new observation is progress and may be able to be combined with other ideas eventually, but rethinking same things will not help
    
9. think of simplified cases or imagine assuming something you wish exists already exists and solving from there, chances are thing then does exist if helps
    
10. almost always a nice easily proveable solution
    
11. reverse/change ordering of process or look at inverse or just view problem in different way in general
    
12. if something reminds you of standard algorithm, think of every way you know how to do that standard thing and see if any modification relates to what you are doing
    
13. if something seems random in statement like any abnormal constraint or is similar to known problem but different in some way, is probably key to solving so consider why it is put in statement
    
14. don't forget sometimes can brute force small choices or if too many choices can pick random one or something that stands out (like max/min)
    
15. don't overcomplicate. try multiple directions, if too many steps or edge cases probably not right direction
    
16. restate problem/conditions in as many different ways as you can to get new perspectives
    
17. believe you can solve every problem, but also treat every problem as a challenge that you take one step at a time. even most standard ideas you can learn on your own if you treat same way as any other problem.
    
18. if something you remember very vaguely seems similar but you don't remember source and barely remember details, don't waste time trying to remember old thing, just start resolving from scratch
    
19. Sometimes can try to cheese with random/heuristic if running out of time. Especially true for OI contests with subtasks.
    

Also it is good to use problem constraints to guide your initial direction of thinking, but don't let it constrain you to specific ideas. And whatever you do **don't misread the problem**, better to spend slightly longer reading and understanding correctly than solve wrong thing.

# Implementation Tips

Try to have clear idea of each segment of code you will write, then write as fast as possible. Sometimes you don't have clear idea of entire code you write and only general outline, and that's ok, but in your mind have different parts of code in small chunks and have each small chunk planned out clearly before you write then think if needed before writing next part. **Try to keep plan your code to be as concise as possible while still easily readable and make it where you are not rewriting same thing multiple times.**

Also for debugging, just make a bunch of print statements in code and look for problems. Try to binary search and figure out where in the code the outputs are first not what you'd expect. Also try working through some examples by hand following steps of code, and read through every single line of code. It is likely the mistake is somewhere where you were sure you couldn't mess up lol.

# Allocating Time in OI Contest

I'm assuming 3 problems in 4 hours (adjust scale as needed). **I usually read all 3 problems in first 15 minutes, then spend about 15 minutes each to think about each problem and decide order of difficulty I find easiest. If I fully mind solve one in that time I immediately implement, otherwise I do as follows. I then try to divide the next three hours to be roughly even among the three problems, and try the problems in order from easiest to hardest.**

**While focusing on a problem, it is very important to stay focused on only that problem.** For most of hour on problem should implement as soon as you full solve but only implement subtasks to test ideas, if you think it help you towards full solution, or you are completely out of new ideas (in which case move on after implementing subtask if u still don't have new ideas). However, **if you already use up ~50min for that problem and still don't know full solution and won't reach in next 5min, even if you think you could make more progress, just implement what subtasks you know and move on.** It is important to actually move on as you may have wrongly assessed which problem was easiest so you want to have time to try all the problems (this has been my downfall multiple times in past). This means once you move on don't have more lingering thoughts usually and fully focus on next problem.

# Math + CS Practice

If you are practicing math olympiad and cs olympiad, or just want some reading material that might help you, try reading some of and doing some problems from [this combo book](https://drive.google.com/file/d/1sQtirXxkEfWYuGSKDZ-d7VGYkR_idebY/view). Overall it will be better for you to just do be actively solving more problems for cp practice, but if you have some other free time it is a pretty good read and cp is basically olympiad combo + data structures + implementation anyway.

Practicing for math olympiad in general will also help you with USACO, but if you are only focusing on USACO it is better to just work on cp problems.

# Is USACO worth it?

Idk, but here is some info to help you decide.

Pros: If you practice enough it gives you very strong skills in problem solving and academia-related CS, you will pass coding interviews easily, if you camp you are almost guaranteed to get into MIT, otherwise if you are in a high division it can look good along with other achievements. If you practice focused 2-3 hours every single day with no breaks following this article you will almost certainly camp in 2 years from no prior experience coding experience, and can probably in 1 year if you are already getting ok scores in silver.

Cons: You won't learn how to make web apps or other computer technologies in more practical based projects. However this stuff will be much easier to learn with a strong theoretical background. Without making camp a high USACO division alone is not enough to get you into a top college, you will need other EC's.

# Extra Motivation

**In everything in life, the key to success is learning to find fulfillment in every small step you make towards progress.** Related to USACO, every problem solved and every day of practice is one step closer to your competitive programming goals. When solving a problem every new observation is one step closer to finding the solution.

**Also, make sure you know your priorities and what you really want out of life, don't have regrets.** If you really want to be good in USACO, stop wasting time, stop taking days off, start solving problems as much as you can and you will find success. Obsess over what you want most until you achieve it.