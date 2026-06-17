---
layout: layout.njk
tags:
  - pages
  - proofs
title: Sets
date: 
eleventyNavigation:
  key: 05. Sets
  order: 8
---

# Sets

There are a lot of things to talk about when it comes to sets.
Since it is [assumed](bite-sized-math-for-cs/prerequisites-and-resources) that you already know about things like union, intersection, etc., we're not going to go over set operations.

Some popular sets you might know are:

| **symbols** | **set** | **elements** |
--- | --- | ---
| $\varnothing$ | _the empty set_ | none
| $\mathbb{N}$ | _natural numbers_ (or, _nonnegative integers_ if you don't like to get political)| $\{0, \ 1, \ 2, \ ...\}$ |
| $\mathbb{Z}$ | _integers_ | $\{..., \ -2, \ -1, \ 0, \ 1, \ 2, \ ...\}$ |
| $\mathbb{Q}$ | _rational numbers_ | $\frac{1}{2}, \ -\frac{4}{3}, \ 16, \ etc.$ |
| $\mathbb{R}$ | _real numbers_ | $\pi, \ e, \ -3, \ \sqrt{2}, \ etc.$
| $\mathbb{C}$ | _complex numbers_ | $i, \ \frac{19}{2}, \ \sqrt{2} - 2i, \ etc.$ |

---

Look at this formula:

$A \subseteq B = \forall x [x \in A \implies x \in B]$ 

This is the _subset_ notation ($\subseteq$), and the formula says that for all $x$, if $x$ in $A$, then $x$ in $B$. It also implies that both sets are equal.
When talking about a _proper subset_, the notation is $\subset$, for example $A \subset B$. That means $A$ is a proper subset of $B$, and they are **not** equal.  

### Why is $\varnothing$ is a subset of every set?

Well, think of this: $\varnothing \subseteq B$. That means $\forall x [x \in \varnothing \implies x \in B]$.
That is an implication. The first part of it is clearly false, there is nothing in an empty set, yet we say $x \in \varnothing$. Remember that in an implication, when the antecedent (the "if part") is false, no matter what follows, the whole statement is true. So, both the statements **F $\implies$ T** and **F $\implies$ F** are true. It doesn't matter if $x$ is in $B$ or not, since $x \in \varnothing$ is clearly false, the whole statement is true. 

---

A ==power set== is the set of all subsets of a set.

For example, if our set is $\{T, F\}$ then its power set is $\{\{T\}, \{F\}, \{T, F\}, \varnothing\}$.

Another example is $\mathbb{Z}^+ \in pow(\mathbb{Z})$. It says that the set of positive integers is in the power set of integers. 

---

==Difference== is _every element in set $A$ and not in set $B$_:
$$A - B = \{x \ | \ (x \in A) \cap (x \notin B)\}$$

The ==complement== of a set is the set of all elements that are not in that set. It is denoted with an overline, like $\overline{B}$. 

An example, _if the domain we’re working with is the integers, then the **complement** of the nonnegative integers is the set of negative integers_: $\overline{\mathbb{N}} = \mathbb{Z}^-$.

---

### Finite Cardinality
When a set is finite, the number of elements it has is called its size, or ==_cardinality_==, and it is denoted as $|A|$.  

So, $|A|$ means the "number of elements in set $A$".

---

There are $2^n$ number of subsets of a set that has $n$ elements: $(|A| = n) \implies (|pow(A)| = 2^n)$

But, why is that? 

### Why is the size of a power set is $2^n$?

Alright, we are going to use a string representation for all possible subsets, where an element can be in it, or not.
We're going to put $0$ where the element exists in the set but not in the subset, and we're going to put $1$ where the element exists both in the set and the subset.

Let's say that our set $A$ is $\{a, b, c\}$.

We can say a subset could be the one where none of the elements exist — which is indeed the empty set, so we can represent it as $0, 0, 0$.

Another possibility is a subset where only $a$ exists — we will represent it as such: $1, 0, 0$. This is the subset $\{a\}$.

Going on like this, let's see all the possibilities:

| **string** | **subset** | 
--- | --- 
| $0, 0, 0$ | $\varnothing$ | 
| $1, 0, 0$ | $\{a\}$
| $0, 1, 0$ | $\{b\}$
| $0, 0, 1$ | $\{c\}$
| $1, 1, 0$ | $\{a, b\}$
| $1, 0, 1$ | $\{a, c\}$
| $0, 1, 1$ | $\{b, c\}$
| $1, 1, 1$ | $\{a, b, c\}$

This is indeed our power set, $pow(A)$ which is $\{\varnothing, \{a\}, \{b\}, \{c\}, \{a, b\}, \{a, c\}, \{b, c\}, \{a, b, c\}\}$.

The number of string representations (the number of $n$ bit strings) is the same as $2^n$, which is the size of our power set!

In our case, $n$ is $3$, so the size of our power set is $8$.

---

And, here are some set identities:

| **Identity Laws** |
| :--- |
| $A \cup \varnothing = A$ |
| $A \cap U = A$ |

| **Domination Laws** |
| :--- |
| $A \cup U = U$ |
| $A \cap \varnothing = \varnothing$ |

| **Idempotent Laws** |
| :--- |
| $A \cup A = A$ |
| $A \cap A = A$ |

| **Complementation Law** |
| :--- |
| $\overline{(\overline A)} = A$ |

| **Commutative Law** |
| :--- |
| $A \cup B = B \cup A$ |
| $A \cap B = B \cap A$ |

| **Associative Laws** |
| :--- |
| $A \cup (B \cup C) = (A \cup B) \cup C$ |
| $A \cap (B \cap C) = (A \cap B) \cap C$ |

| **Distributive Laws** |
| :--- |
| $A \cap (B \cup C) = (A \cap B) \cup (A \cap B)$ |
| $A \cup (B \cap C) = (A \cup B) \cap (A \cup B)$ |

| **De Morgan's Laws** |
| :--- |
| $\overline{A \cup B} = \overline A \cap \overline B$ |
| $\overline{A \cap B} = \overline A \cup \overline B$ |

| **Absorption Laws** |
| :--- |
| $A \cup (A \cap B) = A$ |
| $A \cap (A \cup B) = A$ |

| **Complement Laws** |
| :--- |
| $A \cup \overline{A} = U$ |
| $A \cap \overline{A} = \varnothing$ |


---

For a deep dive into an introduction to set theory, you can check out [this wonderful book](https://builds.openlogicproject.org/courses/set-theory/) from [Open Logic Project](https://openlogicproject.org/).
