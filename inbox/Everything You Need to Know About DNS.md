---
title: "Everything You Need to Know About DNS"
source: "https://cs.fyi/guide/everything-you-need-to-know-about-dns"
author:
published: 2023-03-26
created: 2026-08-11
description: "Learn everything you need to know about DNS and how it works"
tags:
  - "clippings"
---
[Home](https://cs.fyi/) [Explore](https://cs.fyi/explore)

If you are reading this article, chances are you have used the Domain Name System (DNS) without even knowing it. DNS is a fundamental part of the internet that allows us to access websites and online services by using human-friendly names instead of numerical addresses. But how does it work exactly? In this article, I will explain the basics of DNS and how it helps us navigate the web.

## What is DNS?

DNS is like a phone book for the internet. It maps domain names, such as `www.example.com`, to IP addresses, such as `192.0.2.1`, which are the actual locations of the servers that host the websites. This way, we don’t have to memorize long strings of numbers to visit our favorite sites. We can just type in the name and let DNS do the rest.

## How does DNS work?

But how does DNS know where to find the IP address for a given domain name? The answer is that it doesn’t know everything by itself. It relies on a network of servers called DNS resolvers that work together to find the answer.

When you type in a domain name in your browser, your computer will first check its local DNS cache to see if it has the answer. If it does, it will use that answer. If it doesn’t, it will send a query to a DNS resolver. The resolver will then check its own cache to see if it has the answer. If it does, it will send the answer back to your computer. If it doesn’t, it will send the query to another DNS resolver. This process will continue until the answer is found or the query times out.

> A DNS resolver is a server that stores DNS records and answers DNS queries.

Let’s break it down with an example. Suppose you want to visit `www.example.com`. Here is the list of steps or places involved in getting the response for `www.example.come`:

- Local Caches are checked
- Recursive DNS Servers are checked
- Root DNS Servers are checked
- Top Level Domain DNS Servers are checked
- Authoritative DNS Servers are checked

### Step 1: Local Caches

The first place your computer will check is its local cache. This is a list of domain names and their corresponding IP addresses that your computer has recently accessed. If the domain name you are looking for is in the cache, your computer will use the IP address from the cache and skip the rest of the steps.

Here is the list of local caches that might have the domain to IP mapping:

- Browser Cache: You might have visited the website before and your browser might have cached the IP address.
- DNS Cache: Based on the TTL (Time To Live) of the DNS record, your computer might have cached the IP address.
- Hosts File: You might have manually added the domain to IP mapping in your hosts file.

### Step 2: Recursive DNS Servers

DNS settings configured on your computer or router will point to a DNS server (by default, it is your ISP’s DNS server). This DNS server is called a recursive DNS server. It will check its own cache to see if it has the answer. If it does, it will send the answer back to your computer. If it doesn’t, it will send the query to the next DNS server in the chain which is the root DNS server.

### Step 3: Root DNS Servers

The root DNS servers are the top-level DNS servers in the DNS hierarchy. They are responsible for delegating the responsibility of answering queries for top-level domains, such as `.com`, `.org`, and `.net`.

They don’t have the IP addresses for the websites themselves. Instead, they have the IP addresses for the top-level domain DNS servers. For example, the root DNS server for `.com` is `a.gtld-servers.net`. You can see the nameservers for the TLD by running:

```
dig +short NS com
dig +short NS org
dig +short NS ai
dig +short NS fyi
dig +short NS io
```

### Step 4: Top Level Domain DNS Servers

The top-level domain DNS servers are responsible for delegating the responsibility of answering queries for second-level domains, such as `example.com`, `example.org`, and `example.ai`. They don’t have the IP addresses for the websites themselves. Instead, they have the IP addresses for the authoritative DNS servers (i.e. the place where the actual DNS records are stored).

You can see the nameservers for the second-level domain by running:

```
dig +short NS cs.fyi
dig +short NS github.com
dig +short NS medium.com
```

### Step 5: Authoritative DNS Servers

This is the place where the actual DNS records are stored. At this stage, the Authoritative DNS server will be asked for the A record of the domain name. The A record is the DNS record that maps a domain name to an IP address. The Authoritative DNS server will then send the IP address back to the recursive DNS server. The recursive DNS server will then send the IP address back to your computer.

## How does DNS work in practice?

Let’s see how DNS works in practice by using the `dig` command. `dig` is a command-line tool for querying DNS name servers. It is available on most Linux and MacOS systems. You can install it on Windows by using [Chocolatey](https://chocolatey.org/).

```
choco install dig
```

Let’s say we want to find the IP address for `www.example.com`. We can use the `dig` command to find the IP address:

```
dig +short www.example.com
```

The `+short` option tells `dig` to only print the answer section of the response. The output will look something like this:

```
93.184.216.34
```

This is the IP address for `www.example.com`. But how did `dig` find this IP address? Let’s see what happened behind the scenes.

First, `dig` will check its local cache to see if it has the answer. If it does, it will use that answer. If it doesn’t, it will send a query to a DNS resolver. The resolver will then check its own cache to see if it has the answer. If it does, it will send the answer back to `dig`. If it doesn’t, it will send the query to another DNS resolver. This process will continue until the answer is found or the query times out.

Let’s see what happened in this case. We can use the `dig` command with the `+trace` option to see the full response:

```
dig +trace www.example.com
```

I am not going to show the full output here since it is quite long. But you can run this command yourself and notice the different DNS servers that were involved in the process.

## Debugging DNS Issues

If you are having trouble accessing a website, you can use the `dig` command to debug the issue. Let’s see some practical examples of how we can use the `dig` command.

### Checking DNS resolution for a Domain

You can use `dig` to check whether a domain name can be resolved to an IP address. Here’s an example:

```
dig example.com +short
```

This command will return the IP address(es) associated with the domain name `google.com`. The `+short` option is used to display only the IP addresses, without any additional information.

### Retrieving DNS records for a Domain

You can use `dig` to retrieve various types of DNS records for a domain name. For example, to retrieve all `A` records for a domain, you can use the following command:

```
dig example.com A
```

This will return a list of all A records associated with the domain `example.com`.

Similarly, to retrieve all `MX` records for a domain, you can use the following command:

```
dig example.com MX
```

This will return a list of all `MX` records associated with the domain `example.com`.

### Checking DNS propagation

You can use dig to check whether DNS records have been propagated to all DNS servers. For example, to check whether a domain’s `MX` records have been propagated, you can use the following command:

```
dig example.com MX +trace
```

The `+trace` option is used to show the path of the DNS resolution process, starting from the root DNS servers. This will help you identify whether there are any DNS servers that have not yet received the updated DNS records.

### Checking DNSSEC validation

You can use dig to check whether `DNSSEC` validation is working properly for a domain name. For example, to check whether a domain’s `DNSSEC` records are valid, you can use the following command:

```
dig example.com +dnssec
```

This will show the DNSSEC-related records for the domain, and whether they are valid.

> DNSSEC is a security extension to the Domain Name System (DNS) that authenticates the source of the DNS data and the integrity of the data. It also provides a mechanism to prevent DNS data from being tampered with during transit.
> 
> You can read more about DNSSEC [here](https://en.wikipedia.org/wiki/Domain_Name_System_Security_Extensions).

### Querying a specific DNS server

You can use `dig` to query a specific DNS server for DNS records. For example, to query the Google Public DNS server (`8.8.8.8`) for `A` records for a domain, you can use the following command:

```
dig example.com A @8.8.8.8
```

This will send the DNS query to the specified DNS server (in this case, 8.8.8.8), instead of using the default DNS server configured on the local machine.

## Common DNS errors

There are a few common DNS errors that you might encounter. Here are some of them:

### DNS\_PROBE\_FINISHED\_NXDOMAIN

This error means that the domain name does not exist. This could be because the domain name was mistyped, or because the domain name has expired.

### DNS\_PROBE\_FINISHED\_NO\_INTERNET

This error means that the domain name exists, but the DNS server is not reachable. This could be because the DNS server is down, or because the DNS server is not reachable due to a network issue.

### DNS\_PROBE\_FINISHED\_BAD\_CONFIG

This error means that the DNS server is not reachable. This could be because the DNS server is down, or because the DNS server is not reachable due to a network issue.

### How to Flush DNS Cache

There might be times when you want to flush the DNS cache on your local machine. You can use the `ipconfig` command to do this on Windows, and the `dscacheutil` command to do this on MacOS.

Here is the command to flush the DNS cache on Windows:

```
ipconfig /flushdns
```

On MacOS, you can use the following command:

```
dscacheutil -flushcache
```

## Conclusion

In this article, we learned about DNS and how it works. We also learned how to use the `dig` command to query DNS servers for DNS records. I hope you found this article useful; feel free to share it with your friends and colleagues.