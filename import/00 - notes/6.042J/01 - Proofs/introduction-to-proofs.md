---
layout: layout.njk
tags:
  - pages
  - proofs
title: Introduction to Proofs
date: 
eleventyNavigation:
  key: 00. Introduction to Proofs
  order: 3
---

# Introduction to Proofs

## Propositions

So, what is a _proposition_?

A ==proposition== is a statement that is either true or false.

Both of these are propositions:

$3 + 5 = 8$
$2 + 2 = 5$

While the first one is true, the second is false. But, both of them are propositions. 

However, it is not always easy to decide whether a proposition is true or false. For example, a statement like _"It is five o'clock"_ has a truth value that varies depending on the circumstance.  

Now, here is another proposition:
_The value of $n^2 + n + 41$ is prime for every nonnegative integer $n$._

Starting with $0$, we can check as many values for $n$ as we wish. Eventually though, we will find that plugging $40$ for $n$ gives a number that is not a prime. So, we have found that this proposition is, in fact, false.

But, we had to try only 40 different values to find that out. Now, imagine if things were not so easy. Here is the thing: 

> You can’t check a claim about an infinite set by checking a finite set of its elements.

A beautiful example of this is [Goldbach's conjecture](https://en.wikipedia.org/wiki/Goldbach%27s_conjecture), which states that _every even integer greater than 2 is the sum of two primes_. We know that's [true for numbers up to $4 \times 10^{18}$](https://web.archive.org/web/20221027181947/http://sweet.ua.pt/tos/goldbach.html), but we don't know if the proposition itself is true.

## Predicates
A ==predicate== is a proposition with a variable — which means that we don't know its truth value until we are given a value for the variable. 

If $P(n)$ is the predicate "_$n$ is a perfect square_", then $P(4)$ would be true, but $P(5)$ would be false.

## Axioms
Propositions that are accepted to be true are called ==axioms==. 

A sequence of logical deductions from axioms that concludes with the proposition in question is called a ==proof==.

When it comes to proofs, there are some more terminology we need to be aware of:

==theorems==: important true propositions.
==lemma==: a preliminary proposition useful for proving later propositions.
==corollary==: a proposition that follows in few logical steps from a theorem.

This axiom-and-proof strategy was invented by Euclid, and is called the ==axiomatic method==.

