---
layout: layout.njk
tags:
  - pages
  - proofs
title: Recursive Definitions
date: 
eleventyNavigation:
  key: 09. Recursive Definitions
  order: 12
---

# Recursive Definitions

We can define a ==recursive definition== as a way of constructing new data elements from previous ones, i.e., _defining something in terms of a simpler version of the same thing_.

There are two parts to it: ==base case(s)== and ==constructor case(s)==.

We can look at a binary string as an example. Usually, a binary string is defined as a sequence of $0$'s and $1$'s. An example of the string $1011$ is the tuple $(1, \ 0, \ 1, \ 1)$.
But, with recursive definition, we can denote it as nested pairs, such as $\textlangle1, \textlangle0, \textlangle 1, \textlangle 1, \lambda \textrangle \textrangle \textrangle \textrangle$, where $\lambda$ denotes the empty string — in this case, the base case. 

A well-known example of a _recursive function_ is the Fibonacci numbers:

$F(0) = 0$
$F(1) = 1$
$F(n) = F(n - 1) + F(n - 2) \quad  \text{for }n \geq 2$

---

Let's now look at another example.
Let's say we want to define a set of strings, $M$, containing left and right brackets that match up: $M \subseteq \{ \ ], \ [ \ \}^*$. 
Okay, the notation looks funky, but it's a way to denote a set of finite strings, using an asterisk.

So, the base case is the empty string $\lambda$, if we concatenate it to a string it doesn't change anything.

The constructor we have is this:

$$\text{if }s, \ t \in M \text{ then } [s]t \in M$$

Okay, so what does it mean?

It says that if $s$ and $t$ are strings of brackets in $M$, then the string $[s]t$ is also in $M$.

Let's see it in action.

We have the base case, that is, both $s$ and $t$ are empty. What we're left with is just a left and a right bracket: **[ ]**.
If $s$ is **[ ]**, and $t$ is empty, we have **[ [ ] ]** as a result.
If $s$ is empty, and $t$ is **[ ]**, we have **[ ] [ ]**. 
And, if both $s$ and $t$ are **[ ]**, we have **[ [ ] ] [ ]**.
We can also imagine $s$ being **[ [ ] ]**, and $t$ being empty, then we have **[ [ [ ] ] ]**.

The cases we defined so far are these:

| string | values 
--- | --- 
| `[]` | $s = \lambda, \ t = \lambda$
| `[[]]` | $s = [ \ ], \ t = \lambda$
| `[][]` | $s = \lambda, \ t = [ \ ]$
| `[[]][]` | $s = [ \ ], \ t = [ \ ]$
| `[[[]]]` | $s = [ \ [ \ ] \ ], \ t = \lambda$

Now, it can go on forever. But, how do we know that we will get matching brackets?

Well, one way we can look at it is this: if a string starts with **]**, then it is not going to be a _matching brackets string_ because it has already lost starting with **]**, it has no pair. 

We can assume that strings that start with **]** won't be in $M$. 

Now, one thing we know is that the only way to get elements in $M$ is by applying the constructor, or it's going to come from the base case itself. This is called the ==extremal clause==, everything that's in $M$ is obtained from the base case and the constructor.
Our base case for this matching brackets example is the empty sequence, so it definitely doesn't start with **]** because it doesn't even start.
And, our constructor rule is $[s]t$, which also doesn't start with **]**, therefore a string starting with **]** is not going to be in $M$.

---

==Structural induction== is _a method for proving that all the elements of a recursively defined data type have some property._

So, it is proving that a property $P(x)$ holds for all $x$ in recursively defined set $R$. In order to do that, we need to prove that every element in each base case in $R$ has the property ($P(b)$ for each base case $b$), also that each constructor holds the property ($P(c(x))$ for each constructor $c$) as well.

Let's see it using our matching brackets example.

|  |
| :--- |
| _Lemma:_ Every string $s$ in $M$ has the same number of **]**'s and **\[**'s. |
| Let $EQ$ be the set of strings with the same number of **]**'s and **\[**'s. |
| We assume $M \subseteq EQ$. |
| Induction hypothesis $P(s)$ is that $s \in EQ$. |
| The base case is $s = \lambda$, which means that $M$ is an empty set. The property holds because we have $0$ left brackets and $0$ right brackets, so we have an equal number of brackets. So, $P(\lambda)$ is true. ✅ |
| The constructor step was in the form of $[s]t$, but we're using the variable $s$ to stand for the string, so let's use $r$ instead. In this case, the constructor step is $[r]t$. |
| The number of **]**'s in $s$ = $(\text{the number of } ]\text{'s in }r) + (\text{the number of } ]\text{'s in }t) + 1$ |
| The number of **\[**'s in $s$ = $(\text{the number of } [\text{'s in }r) + (\text{the number of } [\text{'s in }t) + 1$ |
| Because of $P(r)$, the number of left and right brackets in $r$ have to be equal. |
| Likewise, because of $P(t)$, the number of left and right brackets in $t$ have to be equal as well. |
| Then, $\big((\text{the number of } ]\text{'s in }r) + (\text{the number of } ]\text{'s in }t) + 1\big) = \big((\text{the number of } [\text{'s in }r) + (\text{the number of } [\text{'s in }t) + 1\big)$ |
| Therefore, we realize that $P(s)$ is true: $(\text{the number of ]'s in } s) = (\text{the number of ['s in } s)$ |
| So, by structural induction, $\forall s \in M \ \ s \in EQ$. |
| $M \subseteq EQ. \ \blacksquare$ |
