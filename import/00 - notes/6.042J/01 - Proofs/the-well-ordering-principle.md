---
layout: layout.njk
tags:
  - pages
  - proofs
title: The Well Ordering Principle
date: 
eleventyNavigation:
  key: 02. The Well Ordering Principle
  order: 5
---

# The Well Ordering Principle

This is what the well ordering principle says:
> Every nonempty set of nonnegative integers has a _smallest_ element.

Yes, it looks like a grammatical mistake, but it isn't here. Let's see.

When we proved [that $\sqrt{2}$ is irrational](bite-sized-math-for-cs/unit-01-proofs/two-proof-methods), we actually have taken this principle for granted, we assumed that $\frac{a}{b}$ can be written in the _lowest terms_. 

We also have taken advantage of the _Prime Factorization Theorem_ in the proof mentioned above, so let's use Well Ordering Principle to prove it.

Remember, the Prime Factorization Theorem states that _every positive integer greater than $1$ can be factored as a product of primes_.

|  |
| :--- |
| The proof is by well ordering. |
| Let's say that $C$ is the set of all integers greater than one that can't be factored as a product of primes. (we have chosen the letter $C$ to stand for _counterexamples_). |
| Now, if $C$ is a nonempty set, that means we have at least one counterexample that makes the theorem false. |
| So, we have to show that $C$ is empty in order to come to a conclusion that the theorem is true. |
| We are going to show a contradiction here, so let's assume that $C$ is nonempty. (that there is at least one element in it that is greater than one, and can't be factored as a product of primes.) |
| In that case, by well ordering, there has to be a _smallest_ element $n$ in $C$. |
| Let's call it $n$, it has to be an integer greater than $1$, and it can't be factored as a product of primes. $n$ also can't be prime because it would then still be considered as a product of one prime. |
| But still, $n$ has to be a product of two integers, $a$ and $b$. Of course, $a$ and $b$ have to be less than $n$, and both of them have to be greater than $1$. |
| Remember that the smallest element in $C$ is $n$, and that $a$ and $b$ are smaller than $n$. So, $a$ and $b$ are not in $C$. If they are not in $C$, that means both $a$ and $b$ can be written as a product of primes. |
| Here is the thing: if $a$ can be written as a product of primes $p_1 ... p_k$, and $b$ can be written as a product of primes $q_1 ... q_k$, we can write $n$ as $(p_1 ... p_k)(q_1 ... q_k)$. |
| That shows that $n$ can be written as a product of primes, and it contradicts our first assumption! |
| So, our assumption that $C$ is nonempty must be false. |
| $C$ is empty, therefore there are no counterexamples to our theorem. |
| Therefore, every positive integer greater that $1$ can be factored as a product of primes. $\blacksquare$ |

That is actually a template to use Well Ordering Principle in proofs.

We first define a set of counterexamples $C$, and assume that it is not empty. Since it is a nonempty set (of nonnegative integers), by well ordering principle it has to have a smallest element $m$. At this point, we have to show a contradiction about this smallest element $m$. There is no one way to go about it, but one is to find a counterexample that is smaller than $m$, thus contradicting that $m$ is the smallest element in $C$.
Another way is to show that $m$ is not a counterexample by showing that $P(m)$ (that the theorem holds true for $m$).
