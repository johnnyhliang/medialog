---
layout: layout.njk
tags:
  - pages
  - proofs
title: Induction
date: 
eleventyNavigation:
  key: 07. Induction
  order: 10
---

# Induction

Here is one of the most important ideas in logic (and, obviously, computer science).

==Induction== is _a powerful method for showing a property is true for all nonnegative integers_.

The common analogy for inductive method is this: if we climb the first step of the ladder, we can climb the next step, and the next step, and therefore climb the entire ladder.

Let's see how it goes with another example. Say, we have 5 books on our bookshelf:

```
       .--.           
   .---|__|           
.--|===|--|_          
|  |===|  |'\     .---.
|  |   |  |.'\    |===|
|  |   |  |\.'\   |   |
|  |   |  | \  \  |===|
|  |   |__|  \.'\ |   |
|  |===|--|   \.'\|===|
^--^---'--^    `-'`---^
 0   1   2      3    4
```
<p style="font-size: smaller;"><i>ASCII art from https://www.asciiart.eu/books/books</i></p>

Looking at the books from left to right, we state two rules for ourselves:
1. We are going to read the first book.
2. If a book is read, then we are going to read the following book.

We start by reading book `0`. We know that if we read `0`, we are going to read the following one, book `1`.
If we read book `1`, we know that we are going to read the following one, book `2`.
If we read book `2`, we know that we are going to read the following one, book `3`.
...

So, we know that if book $n$ is read, then book $n + 1$ is going to be read.
We can conclude that every book on this bookshelf is going to be read. And, that's the idea of induction.

It's similar to the domino effect. The first domino falls, and the others follow.

Putting it in formal logic:

$\underline{P(0), \forall n \in \mathbb{N}. \ P(n) \implies P(n + 1)}$
$\quad \quad \quad \quad \forall m \in \mathbb{N}. \ P(m)$

> [!note]
> `P(0)` means: "We know that property P is true for 0"
> `∀n ∈ ℕ. P(n) ⟹ P(n + 1)` means:
  >  - "For all natural numbers n"
   > - "If P is true for n, then P is also true for n+1"
>    - This is called the "inductive step"
>- Therefore: `∀m ∈ ℕ. P(m)` means:
 >   - "P is true for all natural numbers m"


In our example, $P(0)$, having read the book `0`, is the ==basis step==, or the ==base case==.
$P(n)$ is the ==induction hypothesis==. 
The proposition $P(n) \implies P(n + 1)$ is the ==inductive step==.

In a proof, we first need to show that the base case holds. Then, we have to assume $P(n)$ is true, then go on to show that $P(n + 1)$ holds.

#### Why do we assume $P(n)?$
Remember that in an implication, the only specific case we need to look at is the case where the antecedent, the "if part", is true, because the only case where the whole implication is false is when **T** $\implies$ **F**.
So, if we show that the consequent is true while the antecedent is also true, we show that the implication holds for all cases.

Let's try an example.
We can prove the summation formula with induction.

Remember that the sum of $n$ numbers is $\frac{n(n + 1)}{2}$:
$$1 \ + \ 2 \ + \ 3 \ + \ ... \ + \ n = \frac{n(n + 1)}{2}$$

Or, to put it more precisely:

$$\displaystyle\sum_{i = 1} ^{n} i = \frac{n(n + 1)}{2}$$

|  |
| :--- |
| We're going to show that $1 \ + \ 2 \ + \ 3 \ + \ ... \ + \ n = \frac{n(n + 1)}{2}$ using induction. |
| Let $P(n)$:  $1 \ + \ 2 \ + \ 3 \ + \ ... \ + \ n = \frac{n(n + 1)}{2}$ |
| _Base case_: Prove $P(1)$ is true.  $1 = \frac{1(1 + 1)}{2} = \frac{1(2)}{2} = 1$ ✅ |
| _Inductive step_: $P(n) \implies P(n + 1)$ |
| Inductive hypothesis: We assume that $P(n)$ (which is $1 \ + \ 2 \ + \ 3 \ + \ ... \ + \ n = \frac{n(n + 1)}{2}$) is true. |
| We have to show that $P(n + 1)$ is true. So, we have to show that this is true: $1 \ + \ 2 \ + \ 3 \ + \ ... \ + \ n \ + \ (n + 1) = \frac{(n + 1)(n + 2)}{2}$ |
| Now, let's add $n + 1$ to both sides in our inductive hypothesis: $1 \ + \ 2 \ + \ 3 \ + \ ... \ + \ n \ + (n + 1) = \frac{n(n + 1)}{2} + (n + 1)$ |
| Let's do the math on the right side: $\frac{n(n + 1)}{2} + \frac{2n + 2}{2} = \frac{n^2 + 3n + 2}{2}$ |
| If we factor it, we can see that it is the same thing we have wanted: $\frac{n^2 + 3n + 2}{2} = \frac{(n + 1)(n + 2)}{2} \ \blacksquare$ |

---

What we've seen was _ordinary induction_. There is another kind of induction called ==strong induction==. The difference is that strong induction just lets you make more assumptions.

> In an ordinary induction argument, you assume that $P(n)$ is true and try to prove that $P(n + 1)$ is also true. In a strong induction argument, you may assume that $P(0), P(1), \ ...,$ and $P(n)$ are all true when you go to prove $P(n + 1)$.
