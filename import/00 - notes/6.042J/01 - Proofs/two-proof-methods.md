---
layout: layout.njk
tags:
  - pages
  - proofs
title: (Two) Proof Methods
date: 
eleventyNavigation:
  key: 01. (Two) Proof Methods
  order: 4
---

# (Two) Proof Methods

## Proof by Cases
Also called _proof by exhaustion_, or _brute force method_; it is simply the method of breaking a proof into cases, and proving each case separately.

Let's take a look at an example of how we might prove the statement, "if $n$ is an integer, $n^2 + 3n + 2$ is even."

We can look at three cases:
- $n$ is even
- $n = 0$
- $n$ is odd

|                                                                                                                                                                                                                                                            |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The first case is when $n$ is even, we can write it as $2k$. So, $n = 2k, \ k \in \mathbb{Z}$.                                                                                                                                                             |
| Plugging it in, we get $(2k)^2 + 3(2k) + 2$, which is $4k^2 + 6k + 2$.                                                                                                                                                                                     |
| We can factor out a $2$, and write it as $2(2k^2 + 3k + 1)$.                                                                                                                                                                                               |
| Note that what we have now is also a multiple of $2$, so we can write it as $2r$ where $r = 2k^2 + 3k + 1$. But, we don't even have to do that, since it is a multiple of $2$, the whole thing is even, so our proposition is **true for the first case**. |
| The second case is when $n$ is $0$. We can just plug it in again, and get $(0)^2 + 3(0) + 2$, which is just $2$.                                                                                                                                           |
| $2$ is even, so our proposition is **true for the second case** as well.                                                                                                                                                                                   |
| The third case is when $n$ is odd. We can write an odd number as $2k + 1$. Again, let's plug it in to the formula: $(2k + 1)^2 + 3(2k + 1) + 2$.                                                                                                           |
| We get $4k^2 + 4k + 1 + 6k + 3 + 2$. Putting it all together, we have $4k^2 + 10k + 6$. We can factor out $2$ here, which makes it $2(2k^2 + 5k + 3)$.                                                                                                     |
| The fact that we are able to factor out a $2$ shows that it is a multiple of $2$, which means that it is an even number. So, our proposition is **true for the third case**.                                                                               |
| Therefore, we have showed that $n^2 + 3n + 2$ is even if $n$ is an integer. $\blacksquare$                                                                                                                                                                 |


## Proof by Contradiction
If the proposition we're dealing with is false, a false fact has to be true. Read that sentence once again.
A false fact cannot be true, therefore the proposition has to be true. And, this is the way of proof by contradiction.
This is an _indirect proof_.

A well-known example is proving that $\sqrt{2}$ is irrational.
In this case, if the proposition "$\sqrt{2}$ is irrational" is false, then "$\sqrt{2}$ is rational" has to be true. But we're going to show that it cannot be true (a false fact), therefore, our proposition must be true.
Let's take a look at it:

|  |
| :--- |
| So, assume that $\sqrt{2}$ is rational. |
| By definition, in order to be rational, it has to be a ratio of integers, that is, we have to write it in the form $\frac{a}{b}$ (where $b \neq 0$) in the lowest (simplest) terms:  $\sqrt{2} = \frac{a}{b}$ |
| We can take the square of both sides: $2 = \frac{a^2}{b^2}$ |
| Multiplying both sides by $b^2$ we get: $2b^2 = a^2$ |
| Since $a^2$ is an even number, $a$ has to be even (the square of an even number is an even number). |
| That means we can write $a$ as $2c$ where $c$ is an integer. |
| So, now we can write the whole thing as: $2b^2 = (2c)^2$ |
| And, continue: $2b^2 = 4c^2$ |
| Simplifying the expression, we get: $b^2 = 2c^2$ |
| Now, since $b^2$ is an even number, $b$ has to be even as well. |
| We see that both $a$ and $b$ are even — which means they have a common factor, and that means $\frac{a}{b}$ cannot be the most simplified form. We have a contradiction, therefore $\sqrt{2}$ is irrational. $\blacksquare$ |

---

| NOTE: |
| :--- |
| You might wonder why we assumed that if "$n^2$ is even, then $n$ is even". Remember that with [prime factorization](https://en.wikipedia.org/wiki/Fundamental_theorem_of_arithmetic), all integers more than $1$ can be uniquely represented as a product of prime numbers. Since $n$ is one of the divisors of $n^2$, if $2$ is among the primes that divide $n^2$, then one of the prime divisors of $n$ has to be $2$ as well. Therefore, if $n^2$ is even, $n$ is even. |
