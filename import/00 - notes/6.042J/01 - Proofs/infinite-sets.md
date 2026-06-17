---
layout: layout.njk
tags:
  - pages
  - proofs
title: Infinite Sets
date: 
eleventyNavigation:
  key: 10. Infinite Sets
  order: 13
---

# Infinite Sets

Dealing with infinity is not what you expect while studying discrete math. But, we've been working with infinite sets all along — using integers, rationals, etc., so let's look at them a bit more in depth.

One obvious point is one difference between an infinite and a finite set. In a finite set, adding an element makes the set bigger, but that's not true for infinite sets.
Let's say $A$ is a finite set, and $b \notin A$.
Then, $|A \cup \{b\}| = |A| + 1$.
We can see that $|A|$ (the size of $A$) and $|A \cup \{b\}|$ (the size of A with $b$) are not the same.

However, now let's say that $A$ is an infinite set, and $b \notin A$. In this case, we can only say that $A$ is infinite iff there is _bijection_ between $|A|$ and $|A \cup \{b\}|$.
So, if we have an infinite set, and we add an element to it, we still have an infinite set.

But, there is an important idea that _there are different sizes of infinities_ (you might already be familiar with it if you've heard of [Cantor](https://en.wikipedia.org/wiki/Georg_Cantor) before).

Following that idea, we can also differentiate finite sets and infinite sets when it comes to relations. Now, when we think of a surjective relation between two finite sets ($A \text{ surj } B$), we can think of it differently when it comes to infinite sets, now it will mean that the set $A$ is larger or equal to the set $B$, that is, $|A| \geq |B|$.
Likewise, when talking about a bijective relation ($A \text{ bij } B$), when it comes to infinite sets, it will mean that both infinite sets have the same sizes ($|A| = |B|$) — so, two infinite sets have the same size when there is a bijection between them.

There is also a related idea, the _Schroeder-Bernstein Theorem_. It says that if set $A$ is at least as big as set $B$, and conversely if set $B$ is at least as big as set $A$, then set $A$ is the same size as set $B$. (if ($A \text{ surj } B$ and $B \text{ surj }A$), then ($A \text{ bij }B$).)

If English is slowing down your imaginative capabilities, here is the thing put precisely:
$|A| \geq |B| \geq |A| \implies |A| = |B|$

---

Remember that a notation like $A^*$ is used when it comes to the set of finite bit strings $\{0, \ 1\}^*$. Now, if that set is infinite, we'll denote it like $A^\omega$, the infinite set of bit strings $\{0, \ 1\}^\omega$.

---

A ==countable set== is a set where you can list the elements as $a_0, \ a_1, \ a_2, ...$.
So, let's say we have a countable set $A$; we can write down its elements like $a_0, \ a_1, \ a_2, ...$ and, so on. It means that we can create a mapping between the elements and the set $\mathbb{N}$ — what follows from that is there is a bijection between $\mathbb{N}$ and our countable set $A$ ($\mathbb{N} \text{ bij }A$). In that case, $A$ is _countably infinite_. But, finite sets can also be countable.

Also, $N \text{ surj } A$ implies that $A$ is countable as well — remember that it means that the range of $A$ is its whole codomain, and that means all the elements are hit by at least one arrow from $N$. 


Then, what about ==uncountable sets==?
We can start with an example. [Cantor's diagonal argument](https://en.wikipedia.org/wiki/Cantor%27s_diagonal_argument) shows that the set of infinite binary sequences $\{0, \ 1\}^\omega$ is uncountable.

We can think of "a list" of infinite binary sequences. However, using each element diagonally, we can create another new infinite binary sequence, like this:
![An example of Cantor's diagonal argument](https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Diagonal_argument_01_svg.svg/369px-Diagonal_argument_01_svg.svg.png)

In that case, the set of natural numbers is strictly smaller than set $A$, that is, $\mathbb{N} \lt A$, as there is no surjection from the set of natural numbers to $A$. That is, there are elements in $A$ that are not hit by arrows coming from the set of natural numbers.

---

### The Halting Problem Basics
Let's take a look at the Halting Problem that's briefly touched upon in this course:

> The general Halting Problem for some programming language is, given an arbitrary program, to determine whether the program will run forever if it is not interrupted.

The thing we're looking for is a way of detecting that a program does _not_ halt.

Let's say we have a string `s` that defines a procedure (a function) `P`.
We are going to write very crude pseudocode through this example.

So, `s` is something like this:

```
s = '''
def P(f):
    # do stuff (return or not return, that is the question)
'''
```

Now, `s` is said to halt iff `P(s)` returns (when a function returns, obviously it halts). Notice that what we're doing is passing `s` itself to what is defined by `s`.

Let's assume that there is a function `Q` that decides whether `s` halts. We are arguing that it is impossible to exist, but for the sake of contradiction, let's say it does:

```
# THIS CANNOT EXIST
def Q(s):
    If s halts:
        return True
    Else:
        return False

```

So, `Q(s)` returns true if `s` halts, and false otherwise. It is a "_halts decider_".

We are now going to have another function `Q_PRIME` that is kind of a modified version of `Q`. 

```
def Q_PRIME(s):
    If !Q(s): # (that means s does not halt)
        return True
    Else:
        go on forever # (that means s halts)
```

So, `Q_PRIME(s)` returns true if `Q(s)` returns false, and it returns nothing (it doesn't halt) if `Q(s)` returns true.

Again, if `Q_PRIME(s)` returns nothing, that means `s` halts (because `Q_PRIME(s)` returns nothing when `Q(s)` returns true. And, `Q(s)` returns true when `s` halts).

Now, just like `s` defining a function `P`, let's say that `t` defines the function `Q_PRIME` itself.

So, `t` is said to halt iff `Q_PRIME` returns (when a function returns, obviously it halts).

Here is the thing, though: When we pass `Q_PRIME` the string defining itself (`t`), there is a contradiction.
`Q_PRIME(t)` returns iff `t` doesn't halt (because `Q(t)` returns false). That is, if `Q_PRIME` doesn't halt, it returns — this is a contradiction.
So, `t` halts iff `t` doesn't halt.

In short, if `Q_PRIME(t)` returns, that means it halts. But, it can only return if it doesn't halt, that is, if `Q(t)` returns false, because that's how we defined it.

When applied to itself, we reach a contradiction.
And, therefore there cannot be such `Q`, a "_halts decider_".
It is _undecidable_.

---

Self-referentiality is more than an interesting idea. It has an important role in set theory, computer science, and the problem of consciousness as well. 
For our purposes, _self-application_, the idea of taking a function and applying it to itself, is important. 
There are some classic examples like 

$$\text{This sentence is false.}$$ 

If it's false, then it has to be true; but when it's true, it means that it's false. That's a paradox.

But, _self-application_ is taken for granted in computer science. Take a look at the simple trivial example like the `pow` function that returns the result of taking $x$ to the power of $y$:

```python
from math import pow

pow(pow(2, 3), 2) # 64.0
pow(pow(pow(2, 3), 2), 4) # 16777216.0

```

---

### Russell's Paradox
What Russell was proposing was this:
$W = \{s \in \text{Sets} \ | \ s \notin s\}$

So, $W$ is a collection of sets $s$ such that $s$ is not a member of $s$; _a collection of sets that are not members of themselves_.

It implies that $s \in W \text{ iff }s \notin s$.
Now, if we let $s$ be $W$, that's a contradiction: $W \in W \text{ iff }W \notin W$.

But, there is a fix: we can avoid this paradox if we don't allow $W$ to be a set.
That's okay, but it raises another philosophical question: when is a _set_ a set, and when is it not a set?

==ZFC (Zermelo-Frankel set theory with Choice)==, which provides an axiomatic system for set theory addresses this issue of self-referentiality, and states that [no set can be a member of itself](https://en.wikipedia.org/wiki/Axiom_of_regularity#No_set_is_an_element_of_itself):

Also, all sets are _well-founded_ under membership:
$x \in y \land [\forall z \ z \in x \implies z \notin y]$ 
Meaning that $x$ is built out of things that are not in $y$.
It's also said that $x \text{ is } \epsilon \text{ minimal in } y$.
Remember the well-ordering principle? Every nonempty set of nonnegative integers has to have a _least_ element, in other words, it can't be decreasing infinitely. It is a similar idea: you can't have an infinite sequence of sets where each of which is a member of the previous one.
