---
title: "What is HTTP?"
source: "https://www.cloudflare.com/en-gb/learning/ddos/glossary/hypertext-transfer-protocol-http/"
author:
published:
created: 2026-08-05
description: "Hypertext Transfer Protocol (HTTP) is the foundation of the World Wide Web, and is used to load web pages using hypertext links. Learn more about HTTP."
tags:
  - "clippings"
---
Preview Mode

[Documentation](https://staging.mrk.cfdata.org/mrk/redwood-blade-repository/)

The Hypertext Transfer Protocol is used to load pages on the Internet using hyperlinks.

Copy article link

The Hypertext Transfer Protocol (HTTP) is the foundation of the World Wide Web, and is used to load webpages using hypertext links. HTTP is an [application layer](https://www.cloudflare.com/learning/ddos/application-layer-ddos-attack/) protocol designed to transfer information between networked devices and runs on top of other layers of the network [protocol](https://www.cloudflare.com/learning/network-layer/what-is-a-protocol/) stack. A typical flow over HTTP involves a client machine making a request to a server, which then sends a response message.

## What is in an HTTP request?

An HTTP request is the way Internet communications platforms such as web browsers ask for the information they need to load a website.

Each HTTP request made across the Internet carries with it a series of encoded data that carries different types of information. A typical HTTP request contains:

1. HTTP version type
2. a URL
3. an HTTP method
4. HTTP request headers
5. Optional HTTP body.

Let’s explore in greater depth how these requests work, and how the contents of a request can be used to share information.

## What is an HTTP method?

An HTTP method, sometimes referred to as an HTTP verb, indicates the action that the HTTP request expects from the queried server. For example, two of the most common HTTP methods are ‘GET’ and ‘POST’; a ‘GET’ request expects information back in return (usually in the form of a website), while a ‘POST’ request typically indicates that the client is submitting information to the web server (such as form information, e.g. a submitted username and password).

## What are HTTP request headers?

HTTP headers contain text information stored in key-value pairs, and they are included in every HTTP request (and response, more on that later). These headers communicate core information, such as what browser the client is using and what data is being requested.

Example of HTTP request headers from Google Chrome's network tab:

![HTTP request headers](https://www.cloudflare.com/img/learning/ddos/glossary/hypertext-transfer-protocol-http/http-request-headers.png "HTTP request headers")

## What is in an HTTP request body?

The body of a request is the part that contains the ‘body’ of information the request is transferring. The body of an HTTP request contains any information being submitted to the web server, such as a username and password, or any other data entered into a form.

## What is in an HTTP response?

An HTTP response is what web clients (often browsers) receive from an Internet server in answer to an HTTP request. These responses communicate valuable information based on what was asked for in the HTTP request.

A typical HTTP response contains:

1. an HTTP status code
2. HTTP response headers
3. optional HTTP body

Let's break these down:

## What’s an HTTP status code?

HTTP status codes are 3-digit codes most often used to indicate whether an HTTP request has been successfully completed. Status codes are broken into the following 5 blocks:

1. 1xx Informational
	2. 2xx Success
	3. 3xx Redirection
	4. 4xx Client Error
	5. 5xx Server Error

The “xx” refers to different numbers between 00 and 99.

Status codes starting with the number ‘2’ indicate a success. For example, after a client requests a webpage, the most commonly seen responses have a status code of ‘200 OK’, indicating that the request was properly completed.

If the response starts with a ‘4’ or a ‘5’ that means there was an error and the webpage will not be displayed. A status code that begins with a ‘4’ indicates a client-side error (it is very common to encounter a ‘404 NOT FOUND’ status code when making a typo in a URL). A status code beginning in ‘5’ means something went wrong on the server side. Status codes can also begin with a ‘1’ or a ‘3’, which indicate an informational response and a redirect, respectively.

## What are HTTP response headers?

Much like an HTTP request, an HTTP response comes with headers that convey important information such as the language and format of the data being sent in the response body.

Example of HTTP response headers from Google Chrome's network tab:

![HTTP response headers](https://www.cloudflare.com/img/learning/ddos/glossary/hypertext-transfer-protocol-http/http-response-headers.png "HTTP response headers")

## What is in an HTTP response body?

Successful HTTP responses to ‘GET’ requests generally have a body which contains the requested information. In most web requests, this is HTML data that a web browser will translate into a webpage.

## Can DDoS attacks be launched over HTTP?

Keep in mind that HTTP is a “stateless” protocol, which means that each command runs independent of any other command. In the original spec, HTTP requests each created and closed a [TCP](https://www.cloudflare.com/learning/ddos/glossary/tcp-ip/) connection. In newer versions of the HTTP protocol (HTTP 1.1 and above), persistent connection allows for multiple HTTP requests to pass over a persistent TCP connection, improving resource consumption. In the context of [DoS](https://www.cloudflare.com/learning/ddos/glossary/denial-of-service/) or [DDoS attacks](https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/), HTTP requests in large quantities can be used to mount an attack on a target device, and are considered part of application layer attacks or [layer 7](https://www.cloudflare.com/learning/ddos/what-is-layer-7/) attacks.