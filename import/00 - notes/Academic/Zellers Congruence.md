For finding day of the week given a gregorian calendar dar

```latex
For calculating the day of the week, we will use Zeller's Congruence, which is one of the most common algorithms for calculating this

$h=[q+\lfloor\frac{13(m+1)}{5}\rfloor + K = \lfloor\frac{K}{4} \rfloor + \lfloor \frac{J}{4}\rfloor -2J ]\mod 7$

Where h is the day of the week

q = day of the month

m = month (March = 3, April = 4,..., Jan and Feb are months 13 and 14 of previous yr respectively)

K = year mod 100

J = $\lfloor \frac{year}{100} \rfloor$

```

