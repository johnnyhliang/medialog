---
layout: layout.njk
tags:
  - pages
  - proofs
title: Quantifiers and Predicate Logic
date: 
eleventyNavigation:
  key: 04. Quantifiers and Predicate Logic
  order: 7
---

# Quantifiers and Predicate Logic

Look at this sentence:

> Every American has a dream.

Let $A$ be the set of Americans, and $D$ be the set of dreams, and $H(a, d)$ be the predicate that says "American $a$ has the dream $d$".

Quantifiers that are mostly used are the ==existential quantifier== ("there exists," denoted as $\exists$), and the ==universal quantifier== ("for all," denoted as $\forall$).

We can try to write that sentence using quantifiers in this way:

$\exists d \in D \ \forall a \in A: \ H(a, d)$ 

It reads as "there exists a dream in the set of dreams such that all Americans have it".

But, it means that there is a dream that every American has, that every American has the same dream. This is not what we wanted!

Let's do it better:

$\forall a \in A \ \exists d \in D : \ H(a, d)$ 

Now, it says that every American has their own dream.

#### Negating Quantifiers

$\neg (\forall x P(x))$ is equivalent to $\exists x \ \neg P(x)$.

Let's say that $P(x)$ stands for "x likes parrots." 
$\neg (\forall x P(x))$ reads as "not everyone likes parrots."
$\exists x \ \neg P(x)$ reads as "there exists someone who doesn't like parrots."
Both of them mean the same thing.

Also, $\neg (\exists x P(x))$ is equivalent to $\forall x \ \neg P(x)$.
This time, let's say that $P(x)$ stands for "$x$ likes being mocked."
$\neg (\exists x P(x))$ reads as "There exists no one that likes being mocked."
$\forall x \ \neg P(x)$ reads as "Everyone dislikes being mocked."
They also mean the same thing.

These are also called **De Morgan's Law for Quantifiers**.

---

Now, let's look at this sentence:
> All that glitters is not gold.

If we let $G(x)$ to indicate "glitters," and $Au(x)$ to indicate "being gold," we can perhaps translate it into a formula as such:

$\forall x [G(x) \implies \neg Au(x)]$

But, it says that "everything that glitters is not gold". Think about it for a minute. Is it [what the poet really meant](https://en.wikipedia.org/wiki/All_that_glitters_is_not_gold#Origins)?

The formula is not what we mean it to be; gold glitters — gold is one of the things that glitters, so it is not true that everything that glitters is not gold.

So, the correct way to put it is this:

$\neg \forall x[G(x) \implies Au(x)]$ 

Now, it says what we mean it to say, "not everything that glitters is gold."
